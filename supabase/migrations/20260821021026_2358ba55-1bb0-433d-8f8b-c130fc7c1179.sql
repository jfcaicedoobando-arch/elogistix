-- ============================================================================
-- Ola 2 · Fase B2 — Automatización
--   O2.11.1 Reproceso diario de comisiones pendientes (sin sesión de usuario)
--   O2.11.2 Verificación semanal de UUIDs ante el SAT + aviso a contabilidad
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Helper interno: el mismo cálculo, sin guardas de sesión.
--    Fuente única de verdad del reproceso (la RPC pública delega aquí).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reprocesar_comisiones_org(p_org uuid)
RETURNS TABLE(procesadas integer, resueltas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_procesadas integer := 0;
  v_resueltas integer := 0;
  v_comision numeric;
  v_estado text;
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_INEXISTENTE: organización requerida'
      USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT id, pago_factura_id
      FROM public.comisiones_recalculo_pendiente
     WHERE organization_id = p_org AND resuelto_at IS NULL
     ORDER BY created_at
  LOOP
    v_procesadas := v_procesadas + 1;
    BEGIN
      PERFORM public.calcular_comision_pago(v_row.pago_factura_id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlstate_code = SQLSTATE,
             sqlerrm_text = SQLERRM,
             updated_at = now()
       WHERE id = v_row.id;
      CONTINUE;
    END;

    -- Sólo se cierra el pendiente si el recálculo dejó una comisión sana.
    -- Una comisión ya 'Liquidada' se respeta tal cual (guarda del canon).
    SELECT comision_mxn, estado INTO v_comision, v_estado
      FROM public.comisiones_devengadas
     WHERE pago_factura_id = v_row.pago_factura_id;

    IF v_estado = 'Liquidada' OR COALESCE(v_comision, 0) <> 0 THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET resuelto_at = now(),
             resultado_recalculo = 'Comisión recalculada: ' || COALESCE(v_comision, 0)::text,
             updated_at = now()
       WHERE id = v_row.id;
      v_resueltas := v_resueltas + 1;
    ELSE
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlerrm_text = 'Recálculo sigue dando 0 (faltan datos del embarque)',
             updated_at = now()
       WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_procesadas, v_resueltas;
END;
$function$;

COMMENT ON FUNCTION public._reprocesar_comisiones_org(uuid) IS
  'Ola 2 · O2.11.1 — Núcleo del reproceso de la cola de comisiones para UNA organización. Sin guardas de sesión: los llamadores (RPC pública y job de plataforma) son los responsables de autorizar. Idempotente; nunca modifica comisiones Liquidadas.';

REVOKE ALL ON FUNCTION public._reprocesar_comisiones_org(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._reprocesar_comisiones_org(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2) RPC pública: conserva sus guardas y delega en el helper.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reprocesar_comisiones_pendientes(p_org uuid DEFAULT NULL::uuid)
RETURNS TABLE(procesadas integer, resueltas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := COALESCE(p_org, public.current_user_org_id());
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_INEXISTENTE: no hay organización activa'
      USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sólo administración reprocesa comisiones'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.rls_tenant_scope_ok(v_org) THEN
    RAISE EXCEPTION 'LC_TENANT_MISMATCH: organización fuera de alcance'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT r.procesadas, r.resueltas
                 FROM public._reprocesar_comisiones_org(v_org) r;
END;
$function$;

REVOKE ALL ON FUNCTION public.reprocesar_comisiones_pendientes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reprocesar_comisiones_pendientes(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Job de plataforma: recorre todas las organizaciones con cola abierta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reprocesar_comisiones_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_p integer;
  v_r integer;
  v_orgs integer := 0;
  v_procesadas integer := 0;
  v_resueltas integer := 0;
  v_fallos jsonb := '[]'::jsonb;
BEGIN
  FOR v_org IN
    SELECT DISTINCT organization_id
      FROM public.comisiones_recalculo_pendiente
     WHERE resuelto_at IS NULL
  LOOP
    v_orgs := v_orgs + 1;
    BEGIN
      SELECT r.procesadas, r.resueltas INTO v_p, v_r
        FROM public._reprocesar_comisiones_org(v_org) r;
      v_procesadas := v_procesadas + COALESCE(v_p, 0);
      v_resueltas  := v_resueltas  + COALESCE(v_r, 0);
    EXCEPTION WHEN OTHERS THEN
      v_fallos := v_fallos || jsonb_build_object('organization_id', v_org, 'error', SQLERRM);
    END;
  END LOOP;

  INSERT INTO public.app_logs (level, fn, msg, payload)
  VALUES (
    CASE WHEN jsonb_array_length(v_fallos) = 0 THEN 'info' ELSE 'error' END,
    'reprocesar_comisiones_job',
    'Reproceso diario de comisiones pendientes ejecutado',
    jsonb_build_object(
      'organizaciones', v_orgs,
      'procesadas',     v_procesadas,
      'resueltas',      v_resueltas,
      'pendientes',     GREATEST(v_procesadas - v_resueltas, 0),
      'fallos',         v_fallos
    )
  );

  RETURN jsonb_build_object(
    'organizaciones', v_orgs,
    'procesadas',     v_procesadas,
    'resueltas',      v_resueltas,
    'fallos',         v_fallos
  );
END;
$function$;

COMMENT ON FUNCTION public.reprocesar_comisiones_job() IS
  'Ola 2 · O2.11.1 — Barrido diario de plataforma sobre la cola de recálculo de comisiones (todas las organizaciones). Idempotente. Ejecutar sólo vía pg_cron / service_role.';

REVOKE ALL ON FUNCTION public.reprocesar_comisiones_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reprocesar_comisiones_job() TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Aviso interno de CFDI de proveedor cancelado ante el SAT (O2.11.2).
--    Dedupe por factura: máximo un aviso cada 30 días.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_uuid_cancelado_sat(
  p_org uuid,
  p_facturas jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_factura_id uuid;
  v_titulo text;
  v_mensaje text;
  v_insertadas integer := 0;
  v_n integer;
BEGIN
  IF p_org IS NULL OR p_facturas IS NULL OR jsonb_typeof(p_facturas) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_facturas)
  LOOP
    BEGIN
      v_factura_id := (v_item->>'id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;
    IF v_factura_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Dedupe: no repetir el mismo aviso cada semana.
    IF EXISTS (
      SELECT 1 FROM public.notificaciones_internas ni
       WHERE ni.organization_id = p_org
         AND ni.tipo = 'sat_uuid_cancelado'
         AND ni.entidad_id = v_factura_id
         AND ni.created_at > now() - interval '30 days'
    ) THEN
      CONTINUE;
    END IF;

    v_titulo := 'CFDI cancelado ante el SAT: ' ||
                COALESCE(NULLIF(v_item->>'folio_interno', ''), NULLIF(v_item->>'folio_proveedor', ''), 'factura de proveedor');
    v_mensaje := 'El SAT reporta como CANCELADO el CFDI de ' ||
                 COALESCE(NULLIF(v_item->>'proveedor_nombre', ''), 'proveedor sin nombre') ||
                 '. UUID: ' || COALESCE(v_item->>'uuid_fiscal', 'N/D') ||
                 '. Total: ' || COALESCE(v_item->>'total', 'N/D') ||
                 '. Revisa la factura antes de pagarla o deducirla.';

    INSERT INTO public.notificaciones_internas
      (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
    SELECT p_org, om.user_id, 'sat_uuid_cancelado', v_titulo, v_mensaje,
           '/compras/facturas/' || v_factura_id::text, 'proveedor_factura', v_factura_id
      FROM public.organization_members om
     WHERE om.organization_id = p_org
       AND om.role IN ('admin'::app_role, 'admin_org'::app_role,
                       'contador'::app_role, 'auxiliar_contable'::app_role,
                       'tesorero'::app_role);

    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_insertadas := v_insertadas + COALESCE(v_n, 0);
  END LOOP;

  RETURN v_insertadas;
END;
$function$;

COMMENT ON FUNCTION public.notificar_uuid_cancelado_sat(uuid, jsonb) IS
  'Ola 2 · O2.11.2 — Avisa a contabilidad/tesorería/administración de CFDI de proveedor que el SAT reporta cancelados. Dedupe de 30 días por factura. Sólo service_role (la invoca la edge verificar-sat-semanal).';

REVOKE ALL ON FUNCTION public.notificar_uuid_cancelado_sat(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_uuid_cancelado_sat(uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Agenda: reproceso diario de comisiones (06:20 UTC ≈ 00:20 MX).
-- ---------------------------------------------------------------------------
DO $cron$
DECLARE v_jobid bigint;
BEGIN
  IF to_regproc('cron.schedule') IS NULL THEN
    RAISE NOTICE 'pg_cron no disponible: se omite el agendado del reproceso de comisiones';
    RETURN;
  END IF;
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'reprocesar_comisiones_diario';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'reprocesar_comisiones_diario',
    '20 6 * * *',
    $CRON$ SELECT public.reprocesar_comisiones_job(); $CRON$
  );
END
$cron$;

-- ---------------------------------------------------------------------------
-- 6) Agenda: verificación SAT semanal (lunes 14:00 UTC ≈ 08:00 MX).
--    Los encabezados (apikey + X-Cron-Secret) se copian de un job ya
--    existente para NO versionar secretos en el repositorio. En bases sin
--    esos jobs (CI limpio) se omite con NOTICE.
-- ---------------------------------------------------------------------------
DO $cron$
DECLARE
  v_jobid   bigint;
  v_cmd     text;
  v_headers text;
  v_base    text;
BEGIN
  IF to_regproc('cron.schedule') IS NULL THEN
    RAISE NOTICE 'pg_cron no disponible: se omite el agendado de la verificación SAT semanal';
    RETURN;
  END IF;

  SELECT command INTO v_cmd
    FROM cron.job
   WHERE jobname IN ('tc-dof-diario', 'rep-retry-nocturno')
   ORDER BY jobname
   LIMIT 1;

  IF v_cmd IS NULL THEN
    RAISE NOTICE 'Sin job HTTP de referencia: se omite el agendado de verificar_sat_semanal (agendar tras el primer deploy)';
    RETURN;
  END IF;

  v_headers := substring(v_cmd from 'headers := ''(\{.*\})''::jsonb');
  v_base    := substring(v_cmd from 'url := ''(https://[^/]+)/functions/v1/');

  IF v_headers IS NULL OR v_base IS NULL THEN
    RAISE NOTICE 'No se pudieron leer los encabezados del job de referencia: se omite verificar_sat_semanal';
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'verificar_sat_semanal';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'verificar_sat_semanal',
    '0 14 * * 1',
    format(
      $CRON$SELECT net.http_post(url := %L, headers := %L::jsonb, body := jsonb_build_object('trigger','cron','at', now())) AS request_id;$CRON$,
      v_base || '/functions/v1/verificar-sat-semanal',
      v_headers
    )
  );
END
$cron$;
