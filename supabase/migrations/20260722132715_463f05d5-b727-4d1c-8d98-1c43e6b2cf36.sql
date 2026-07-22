
-- =========================================================================
-- Bloque C (P2) — Auditoría R2 · v13.306.1
-- =========================================================================

-- -------------------------------------------------------------------------
-- Helper: rechazo genérico de DELETE
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '%', COALESCE(TG_ARGV[0], 'LC_DELETE_PROHIBIDO: registro inmutable')
    USING ERRCODE = 'P0001';
END;
$$;

-- -------------------------------------------------------------------------
-- R2-18 · DELETE físico de NCs aplicadas
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_nc_no_delete ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_no_delete
  BEFORE DELETE ON public.factura_notas_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_delete('LC_NC_INMUTABLE: cancele la NC en lugar de eliminarla');

-- -------------------------------------------------------------------------
-- R2-21 · Máquina de estados server-side para cotizaciones
-- Estados: Borrador, Enviada, Aceptada, Rechazada, Vencida, En operación.
-- Regla clave: no volver a Borrador desde Aceptada / En operación / Rechazada.
-- Otras regresiones (Aceptada → Enviada, etc.) también quedan bloqueadas.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text := OLD.estado::text;
  v_new text := NEW.estado::text;
BEGIN
  IF v_old IS NULL OR v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Vencida siempre puede aplicarse desde cualquier estado no terminal
  IF v_new = 'Vencida' AND v_old IN ('Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;

  -- Transiciones válidas
  IF (v_old = 'Borrador'      AND v_new IN ('Enviada','Rechazada'))
  OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
  OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_estado_cotizacion ON public.cotizaciones;
CREATE TRIGGER trg_guard_estado_cotizacion
  BEFORE UPDATE OF estado ON public.cotizaciones
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public.guard_estado_cotizacion();

-- -------------------------------------------------------------------------
-- R2-25 · Respeta fecha_vencimiento explícita del usuario
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.facturas_set_fecha_vencimiento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fecha_emision IS NOT NULL AND NEW.fecha_vencimiento IS NULL THEN
    NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
  END IF;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- R2-27 · Integridad de cadena de sustitución
-- (Índice único queda pendiente: existe 1 duplicado histórico a resolver.)
-- -------------------------------------------------------------------------
ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_no_autosustitucion;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_no_autosustitucion
  CHECK (sustituye_a IS NULL OR sustituye_a <> id) NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_sustitucion_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sustituye_a IS NULL THEN RETURN NEW; END IF;

  -- Rechaza ciclos directos: la sustituta ya tiene sustituye_a = NEW.id
  IF EXISTS (
    SELECT 1 FROM public.facturas
    WHERE id = NEW.sustituye_a AND sustituye_a = NEW.id
  ) THEN
    RAISE EXCEPTION 'LC_SUSTITUCION_CICLO: la factura % ya sustituye a la nueva %',
      NEW.sustituye_a, NEW.id USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sustitucion_ciclo ON public.facturas;
CREATE TRIGGER trg_guard_sustitucion_ciclo
  BEFORE INSERT OR UPDATE OF sustituye_a ON public.facturas
  FOR EACH ROW
  WHEN (NEW.sustituye_a IS NOT NULL)
  EXECUTE FUNCTION public.guard_sustitucion_ciclo();

-- -------------------------------------------------------------------------
-- R2-32 · estado_captura sigue a estado en CxP
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._recalc_estado_proveedor_factura(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_captura text;
  v_saldo  numeric;
  v_nuevo  text;
  v_nueva_captura text;
BEGIN
  SELECT estado::text, estado_captura
    INTO v_estado, v_captura
  FROM public.proveedor_facturas
  WHERE id = p_factura_id;

  IF v_estado IS NULL THEN RETURN; END IF;
  IF v_estado IN ('Cancelada','Borrador') THEN RETURN; END IF;

  SELECT COALESCE(saldo, 0) INTO v_saldo
  FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = p_factura_id;

  IF v_saldo IS NULL THEN v_saldo := 0; END IF;

  IF v_saldo <= 0.01 THEN v_nuevo := 'Pagada'; ELSE v_nuevo := 'Vigente'; END IF;

  -- R2-32: sincroniza estado_captura con el estado financiero
  IF v_nuevo = 'Pagada' THEN
    v_nueva_captura := 'pagada';
  ELSIF v_captura = 'pagada' THEN
    -- Reabrió saldo: retrocede de 'pagada' → 'capturada'
    v_nueva_captura := 'capturada';
  ELSE
    v_nueva_captura := v_captura;
  END IF;

  IF v_nuevo IS DISTINCT FROM v_estado
     OR v_nueva_captura IS DISTINCT FROM v_captura THEN
    PERFORM set_config('app.recalc_cxp','1', true);
    BEGIN
      UPDATE public.proveedor_facturas
         SET estado         = v_nuevo::estado_proveedor_factura,
             estado_captura = v_nueva_captura,
             updated_at     = now()
       WHERE id = p_factura_id
         AND (estado::text IS DISTINCT FROM v_nuevo
              OR estado_captura IS DISTINCT FROM v_nueva_captura);
      PERFORM set_config('app.recalc_cxp','0', true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.recalc_cxp','0', true);
      RAISE;
    END;
  END IF;
END;
$$;

-- -------------------------------------------------------------------------
-- R2-22 · Validación ISO-6346 en contenedores (NOT VALID por historial)
-- -------------------------------------------------------------------------
ALTER TABLE public.embarque_contenedores
  DROP CONSTRAINT IF EXISTS contenedor_iso6346;
ALTER TABLE public.embarque_contenedores
  ADD CONSTRAINT contenedor_iso6346
  CHECK (numero_contenedor IS NULL OR numero_contenedor ~ '^[A-Z]{4}[0-9]{7}$') NOT VALID;

-- -------------------------------------------------------------------------
-- R2-24 · Validación RFC y trims en clientes (NOT VALID por historial)
-- -------------------------------------------------------------------------
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_rfc_formato;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_rfc_formato
  CHECK (rfc IS NULL OR rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.trg_clientes_normaliza_campos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre := btrim(NEW.nombre);
    IF NEW.nombre = '' THEN
      RAISE EXCEPTION 'LC_CLIENTE_NOMBRE_REQUERIDO: el nombre no puede estar vacío'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(btrim(lower(NEW.email)), '');
  END IF;
  IF NEW.rfc IS NOT NULL THEN
    NEW.rfc := NULLIF(btrim(upper(NEW.rfc)), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_normaliza_campos ON public.clientes;
CREATE TRIGGER trg_clientes_normaliza_campos
  BEFORE INSERT OR UPDATE OF nombre, email, rfc ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_clientes_normaliza_campos();

-- -------------------------------------------------------------------------
-- R2-26 · Catálogo SAT de motivos de cancelación
-- -------------------------------------------------------------------------
ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_cancelacion_motivo_sat;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_cancelacion_motivo_sat
  CHECK (cancelacion_motivo IS NULL OR cancelacion_motivo IN ('01','02','03','04'));

-- -------------------------------------------------------------------------
-- R2-30 · convertir_a_mxn con validación estricta
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convertir_a_mxn(
  _monto numeric,
  _moneda text,
  _tc_usd numeric,
  _tc_eur numeric
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_mon text := upper(COALESCE(_moneda,'MXN'));
  v_tc  numeric;
BEGIN
  IF _monto IS NULL THEN RETURN 0; END IF;

  IF v_mon = 'MXN' THEN
    RETURN round(_monto, 2);
  END IF;

  IF v_mon NOT IN ('USD','EUR') THEN
    RAISE EXCEPTION 'LC_MONEDA_NO_SOPORTADA: %', v_mon USING ERRCODE = 'P0001';
  END IF;

  v_tc := CASE v_mon WHEN 'USD' THEN _tc_usd ELSE _tc_eur END;

  IF v_tc IS NULL OR v_tc <= 0 THEN
    RAISE EXCEPTION 'LC_TC_REQUERIDO: tipo de cambio % no definido', v_mon
      USING ERRCODE = 'P0001';
  END IF;

  RETURN round(_monto * v_tc, 2);
END;
$$;

-- -------------------------------------------------------------------------
-- R2-19 · Marcado perezoso de 'Vencida' + agendado diario
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.facturas
     SET estado = 'Vencida'::estado_factura,
         updated_at = now()
   WHERE estado::text IN ('Emitida','Parcialmente pagada')
     AND fecha_vencimiento IS NOT NULL
     AND fecha_vencimiento < CURRENT_DATE
     AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_facturas_vencidas() TO service_role;

-- Agenda diaria (idempotente)
DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'marcar_facturas_vencidas_diario';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'marcar_facturas_vencidas_diario',
    '0 6 * * *',
    $CRON$ SELECT public.marcar_facturas_vencidas(); $CRON$
  );
END $$;

-- -------------------------------------------------------------------------
-- R2-20 · Alertas de vencimiento CxP
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.cxp_alertas_vencimiento AS
SELECT
  pf.id                    AS proveedor_factura_id,
  pf.organization_id,
  pf.proveedor_id,
  pf.proveedor_nombre,
  pf.folio_proveedor,
  pf.folio_interno,
  pf.moneda,
  pf.fecha_vencimiento,
  (pf.fecha_vencimiento - CURRENT_DATE)::int AS dias_a_vencer,
  vs.saldo                 AS saldo,
  pf.estado::text          AS estado
FROM public.proveedor_facturas pf
LEFT JOIN public.v_proveedor_facturas_saldo vs
  ON vs.proveedor_factura_id = pf.id
WHERE pf.deleted_at IS NULL
  AND pf.estado::text NOT IN ('Cancelada','Borrador','Pagada','Rechazada')
  AND pf.fecha_vencimiento IS NOT NULL
  AND COALESCE(vs.saldo, 0) > 0.01
  AND public.is_org_member(pf.organization_id);

GRANT SELECT ON public.cxp_alertas_vencimiento TO authenticated;

CREATE OR REPLACE FUNCTION public.cxp_alertas_vencimiento(p_dias int DEFAULT 7)
RETURNS SETOF public.cxp_alertas_vencimiento
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.cxp_alertas_vencimiento
  WHERE dias_a_vencer <= p_dias
  ORDER BY dias_a_vencer ASC, fecha_vencimiento ASC;
$$;

GRANT EXECUTE ON FUNCTION public.cxp_alertas_vencimiento(int) TO authenticated;

-- -------------------------------------------------------------------------
-- R2-31 · Utilidad NULL cuando aún no hay CxP capturada
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid;
  _has_cv boolean; _has_pf boolean; _has_seg boolean; _has_cc boolean;
  _estado_costos text;
  _base jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.conceptos_venta WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_cv;
  SELECT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_cc;
  SELECT EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE embarque_id=_embarque_id AND deleted_at IS NULL
                  AND estado::text NOT IN ('Borrador','Cancelada')) INTO _has_pf;
  SELECT EXISTS(SELECT 1 FROM public.seguros_embarque WHERE embarque_id=_embarque_id AND deleted_at IS NULL) INTO _has_seg;

  -- Sin facturas de proveedor ni seguros = costos reales incompletos
  IF NOT _has_pf AND NOT _has_seg THEN
    _estado_costos := 'incompleto';
  ELSE
    _estado_costos := 'completo';
  END IF;

  -- Llama a la implementación previa vía SQL inline (reutilizando el cuerpo original)
  WITH
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total
    FROM public.facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada','Sustituida')
  ),
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, public.saldo_factura(f.id) AS saldo FROM f
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda, estado::text AS estado
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.subtotal - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado,
           (pf.subtotal
              - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
              - coalesce((SELECT sum(pp.monto_en_moneda_factura)
                          FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),0)
           ) AS saldo
    FROM pf
  ),
  totales AS (
    SELECT
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'estado_costos', _estado_costos,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', CASE
      WHEN _estado_costos = 'incompleto' THEN NULL
      ELSE round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2)
    END,
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre
      ) x
    )
  ) INTO _base FROM totales t;

  RETURN _base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated;
