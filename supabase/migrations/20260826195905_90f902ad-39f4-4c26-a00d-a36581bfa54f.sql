-- ============================================================================
-- QA ronda 2 · Etapa 1 (hallazgos validados en auditoría)
--   D-02 + R-02: candado CxC/CxP al cancelar embarque también en escritura
--                directa (trigger) y liberación de cotizaciones ligadas.
--   D-03: la baja de cliente ignora embarques Cancelados y cotizaciones en
--         Borrador como dependencias.
--   D-04: folio de proveedor único normalizado (upper/btrim) por org+proveedor.
--   W-09: storage no expone documentos de embarques/documentos en papelera.
--   N-03: el portal de cliente no lee embarques ni cotizaciones en papelera.
-- Fuera de alcance deliberado (ver auditoría): D-01, D-05, N-07, W-08, R-01, R-04.
-- ============================================================================

-- 1) Trigger con la misma validacion que la RPC.
CREATE OR REPLACE FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado = 'Cancelado'::public.estado_embarque
     AND OLD.estado NOT IN ('Cancelado'::public.estado_embarque, 'Cerrado'::public.estado_embarque)
     AND NEW.deleted_at IS NULL
     AND current_setting('app.via_rpc_estado', true) IS DISTINCT FROM '1' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = NEW.id
        AND f.deleted_at IS NULL
        AND f.estado IN ('Emitida', 'Vencida', 'Parcialmente pagada')
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXC: cancela o sustituye las facturas de cliente antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = NEW.id
        AND pf.deleted_at IS NULL
        AND pf.estado <> 'Cancelada'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXP: cancela las facturas de proveedor antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_embarques_cancelacion_cxc_cxp ON public.embarques;
CREATE TRIGGER trg_embarques_cancelacion_cxc_cxp
  BEFORE UPDATE OF estado ON public.embarques
  FOR EACH ROW EXECUTE FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp();

-- 2) RPC: establece la GUC app.via_rpc_estado y (R-02) libera cotizaciones
--    al cancelar.
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_flr date;
  v_estado_actual public.estado_embarque;
  v_expediente text;
  v_tipo public.tipo_operacion;
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN
    -- Claim en vuelo: otra petición con la misma llave la está ejecutando.
    IF v_resp ? '__idempotency_pending' THEN RETURN v_resp; END IF;
    -- Respuesta cacheada de una ejecución anterior: se marca como replay para
    -- que el frontend NO escriba bitácora ni la confunda con un avance real.
    RETURN jsonb_set(COALESCE(v_resp, '{}'::jsonb), '{replay}', 'true'::jsonb, true);
  END IF;

  -- BL-16: misma frase que cerrar_embarque — la papelera no avanza.
  SELECT organization_id, fecha_llegada_real, estado, expediente, tipo
    INTO v_org_id, v_flr, v_estado_actual, v_expediente, v_tipo
  FROM embarques WHERE id = p_embarque_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  -- QA-R2 D-02: marca que el cambio de estado (incluida la cancelacion) viene
  -- de esta RPC; el trigger embarques_assert_cancelacion_sin_cxc_cxp exige la
  -- GUC para cancelar y aplica la misma validacion CxC/CxP en escritura directa.
  PERFORM set_config('app.via_rpc_estado', '1', true);

  -- B-01: no cancelar una operación que todavía conserva CxC o CxP vivas.
  IF p_nuevo_estado = 'Cancelado' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = p_embarque_id
        AND f.deleted_at IS NULL
        AND f.estado IN ('Emitida', 'Vencida', 'Parcialmente pagada')
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXC: cancela o sustituye las facturas de cliente antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = p_embarque_id
        AND pf.deleted_at IS NULL
        AND pf.estado <> 'Cancelada'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXP: cancela las facturas de proveedor antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- v13.303.42: al confirmar un borrador sin folio, reservar expediente ahora.
  IF v_estado_actual = 'Borrador'::estado_embarque
     AND p_nuevo_estado = 'Confirmado'
     AND (v_expediente IS NULL OR v_expediente = '') THEN
    v_expediente := public.generar_expediente(coalesce(v_tipo::text, ''));
    UPDATE embarques SET expediente = v_expediente WHERE id = p_embarque_id;
  END IF;

  IF p_nuevo_estado = 'Cerrado' THEN
    PERFORM public.cerrar_embarque(p_embarque_id);

    PERFORM set_config('app.bypass_cierre','on', true);

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
       v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', 'Cerrado'));

    PERFORM set_config('app.bypass_cierre','off', true);

    v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Cerrado');
    PERFORM public.idempotency_store(p_request_id, v_resp);
    RETURN v_resp;
  END IF;

  IF p_nuevo_estado = 'Arribo' AND v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- BUG-10: guarda optimista — el FOR UPDATE del SELECT inicial bloquea la
  -- fila, pero se conserva el predicado de estado como segunda línea de defensa.
  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id
     AND estado = v_estado_actual;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_CONCURRENTE: el embarque cambió de estado durante la transición'
      USING ERRCODE = '40001';
  END IF;

  -- QA-R2 R-02: al cancelar, liberar las cotizaciones ligadas al embarque.
  -- La reversión 'En operación' → 'Aceptada' es housekeeping (mismo patrón
  -- que la papelera: GUC app.liberando_papelera ante guard_estado_cotizacion);
  -- no se tocan subtotal/moneda/conceptos, así que el guard de cotización
  -- congelada no aplica.
  IF p_nuevo_estado = 'Cancelado' THEN
    PERFORM set_config('app.liberando_papelera', 'on', true);
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = p_embarque_id
       AND organization_id = v_org_id;
    PERFORM set_config('app.liberando_papelera', 'off', true);
  END IF;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES
    (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
     v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', p_nuevo_estado));

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado, 'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$
;

REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated, service_role;

-- ============================================================================
-- QA ronda 2 · D-03: dependencias vivas de un cliente.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
  _deps bigint;
  _estado text;
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida para soft delete: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NULL', _table)
    INTO _org USING _id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado o ya borrado';
  END IF;
  IF _org IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_ORG_FUERA_DE_SCOPE: el registro pertenece a otra organización';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  IF _table = 'clientes' THEN
    -- QA-R2 D-03: sólo estados vivos/no terminales cuentan como dependencia:
    -- embarques Cancelados y cotizaciones en Borrador no bloquean la baja.
    SELECT
      (SELECT count(*) FROM public.embarques e
        WHERE e.cliente_id = _id AND e.deleted_at IS NULL
          AND e.estado <> 'Cancelado')
      + (SELECT count(*) FROM public.facturas f WHERE f.cliente_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.cotizaciones c
        WHERE c.cliente_id = _id AND c.deleted_at IS NULL
          AND c.estado <> 'Borrador')
      INTO _deps;
  ELSIF _table = 'embarques' THEN
    SELECT
      (SELECT count(*) FROM public.facturas f WHERE f.embarque_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.proveedor_facturas pf
         WHERE pf.embarque_id = _id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada')
      INTO _deps;
  ELSIF _table = 'facturas' THEN
    SELECT f.estado::text INTO _estado FROM public.facturas f WHERE f.id = _id;
    IF _estado IS DISTINCT FROM 'Borrador' THEN
      RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: sólo facturas en Borrador pueden eliminarse; cancela o sustituye el CFDI'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF COALESCE(_deps, 0) > 0 THEN
    RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: el registro tiene % dependencias vivas', _deps
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2', _table)
    USING _uid, _id;
END
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated, service_role;

-- ============================================================================
-- QA ronda 2 · D-04 (medio)
-- El dedupe de CxP por folio era eludible por case/whitespace (el indice
-- unico vigente incluye fecha_emision y es case-sensitive). Fix: trigger con
-- advisory lock por (org, proveedor, folio normalizado) que compara
-- upper(btrim(folio_proveedor)) en AMBOS lados, excluyendo papelera y
-- canceladas.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.proveedor_facturas_assert_folio_unico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_folio_norm text;
BEGIN
  v_folio_norm := upper(btrim(COALESCE(NEW.folio_proveedor, '')));
  IF v_folio_norm = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND v_folio_norm = upper(btrim(COALESCE(OLD.folio_proveedor, '')))
     AND NEW.proveedor_id IS NOT DISTINCT FROM OLD.proveedor_id
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN
    RETURN NEW;
  END IF;

  -- Serializa altas/ediciones del mismo folio dentro de la org.
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.organization_id::text || ':' || NEW.proveedor_id::text || ':' || v_folio_norm));

  IF EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    WHERE pf.organization_id = NEW.organization_id
      AND pf.proveedor_id IS NOT DISTINCT FROM NEW.proveedor_id
      AND upper(btrim(pf.folio_proveedor)) = v_folio_norm
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'::public.estado_proveedor_factura
      AND pf.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'LC_CXP_FOLIO_DUPLICADO: ya existe una factura viva del proveedor con el folio %', v_folio_norm
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.proveedor_facturas_assert_folio_unico() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_proveedor_facturas_folio_unico ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_folio_unico
  BEFORE INSERT OR UPDATE OF organization_id, proveedor_id, folio_proveedor ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public.proveedor_facturas_assert_folio_unico();

-- ============================================================================
-- QA ronda 2 · W-09 (medio) — storage
-- La policy "Tenant scoped read documentos" leia filas de
-- documentos_embarque/embarques en papelera. Se recrea exigiendo
-- d.deleted_at IS NULL AND e.deleted_at IS NULL en ambas ramas EXISTS.
-- W-08 (limites de bucket) se aplica con la herramienta de buckets, no por SQL.
-- ============================================================================
DROP POLICY IF EXISTS "Tenant scoped read documentos" ON storage.objects;

CREATE POLICY "Tenant scoped read documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM documentos_embarque d
      JOIN embarques e ON e.id = d.embarque_id
      WHERE d.archivo = storage.objects.name
        AND d.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND d.organization_id = current_user_org_id()
        AND e.organization_id = current_user_org_id()
    )
    OR EXISTS (
      SELECT 1
      FROM documentos_embarque d
      JOIN embarques e ON e.id = d.embarque_id
      WHERE d.archivo = storage.objects.name
        AND d.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND has_role(auth.uid(), 'cliente'::app_role)
        AND e.cliente_id IN (SELECT current_user_client_ids())
    )
  )
);

-- ============================================================================
-- QA ronda 2 · N-03 (medio, parte SQL)
-- Las policies RLS del rol cliente en portal leian embarques y cotizaciones
-- en papelera. Se recrean exigiendo deleted_at IS NULL.
-- ============================================================================
DROP POLICY IF EXISTS "Cliente read own embarques" ON public.embarques;
CREATE POLICY "Cliente read own embarques" ON public.embarques
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_id IN (SELECT current_user_client_ids())
);

DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;
CREATE POLICY "Cliente read own cotizaciones" ON public.cotizaciones
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND cliente_id IN (SELECT current_user_client_ids())
);