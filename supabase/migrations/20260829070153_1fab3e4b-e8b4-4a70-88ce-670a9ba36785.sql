-- Ola 4 · Auditoría v14 (medios y bajos SQL). Los reemplazos de cuerpos largos
-- se hacen por parche textual sobre la definición vigente (pg_get_functiondef)
-- con aserción explícita: si el patrón no existe, la migración falla.

-- ============ M-2: cruces con EUR en pagos ============
CREATE OR REPLACE FUNCTION public.convertir_monto_pago_a_factura(p_monto numeric, p_moneda_pago public.moneda, p_tc_pago numeric, p_moneda_fact public.moneda, p_tc_fact numeric) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $fn$
DECLARE
  v_tc numeric;
  v_tc_fact numeric;
  v_mxn numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_fact THEN RETURN p_monto; END IF;

  -- Ruta histórica MXN<->USD: idéntica (usa el TC del pago).
  IF (p_moneda_pago = 'MXN' AND p_moneda_fact = 'USD')
     OR (p_moneda_pago = 'USD' AND p_moneda_fact = 'MXN') THEN
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / v_tc, 4);
    ELSE                          RETURN round(p_monto * v_tc, 4);
    END IF;
  END IF;

  -- M-2: cruces con EUR (EUR<->MXN, EUR<->USD) pivotean en MXN.
  IF p_moneda_pago = 'MXN' THEN
    v_mxn := p_monto;
  ELSE
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    v_mxn := p_monto * v_tc;
  END IF;

  IF p_moneda_fact = 'MXN' THEN RETURN round(v_mxn, 4); END IF;

  v_tc_fact := NULLIF(p_tc_fact, 0);
  IF v_tc_fact IS NULL OR v_tc_fact <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_TC_FACTURA_REQUERIDO: la factura en % necesita tipo de cambio para recibir un pago en %.',
      p_moneda_fact, p_moneda_pago USING ERRCODE = '22023';
  END IF;
  RETURN round(v_mxn / v_tc_fact, 4);
END;
$fn$;

-- ============ M-1: reapertura limpia el snapshot del cierre ============
DO $mig$
DECLARE d text; s text;
BEGIN
  d := pg_get_functiondef('public.reabrir_embarque(uuid,text,text,uuid)'::regprocedure);
  s := E'     SET estado = \'Por liquidar\'::estado_embarque,\n         reabierto_at = now(),';
  IF position(s in d) = 0 THEN
    RAISE EXCEPTION 'M-1: patrón no encontrado en reabrir_embarque';
  END IF;
  d := replace(d, s, E'     SET estado = \'Por liquidar\'::estado_embarque,\n         cerrado_snapshot = NULL,\n         pnl_base = NULL,\n         calculo_snapshot = NULL,\n         reabierto_at = now(),');
  EXECUTE d;
END $mig$;

-- ============ M-8: reglas de auditoría exigen TC > 1 ============
DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public._auditoria_embarques_org_base(uuid)'::regprocedure);
  IF position('NULLIF(e.tipo_cambio_usd,0)' in d) = 0 THEN
    RAISE EXCEPTION 'M-8: patrón no encontrado en _auditoria_embarques_org_base';
  END IF;
  d := replace(d, 'NULLIF(e.tipo_cambio_usd,0)',
                  'NULLIF(CASE WHEN e.tipo_cambio_usd > 1 THEN e.tipo_cambio_usd END,0)');
  EXECUTE d;
END $mig$;

-- ============ M-9: estado de cuenta visible para rol cliente ============
DO $mig$
DECLARE d text; s text;
BEGIN
  d := pg_get_functiondef('public.estado_cuenta_agregados(uuid[],date,date)'::regprocedure);
  s := E'DECLARE\n  v_result jsonb;\nBEGIN';
  IF position(s in d) = 0 THEN
    RAISE EXCEPTION 'M-9: DECLARE no encontrado en estado_cuenta_agregados';
  END IF;
  d := replace(d, s, E'DECLARE\n  v_result jsonb;\n  v_org uuid := public.org_scope();\n  v_es_cliente boolean;\nBEGIN\n  -- M-9 (v14): los usuarios con rol cliente no son miembros de organización\n  -- (org_scope() = NULL) y los KPIs salían en $0. El alcance se deriva de los\n  -- clientes ligados al usuario.\n  IF v_org IS NULL THEN\n    SELECT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid()) INTO v_es_cliente;\n    IF NOT v_es_cliente THEN\n      RAISE EXCEPTION ''LC_ESTADO_CUENTA_SIN_ACCESO: sin organización activa ni cliente ligado'';\n    END IF;\n    IF EXISTS (\n      SELECT 1 FROM unnest(COALESCE(p_cliente_ids, ARRAY[]::uuid[])) AS x(id)\n      WHERE x.id NOT IN (SELECT public.current_user_client_ids())\n    ) THEN\n      RAISE EXCEPTION ''LC_ESTADO_CUENTA_SIN_ACCESO: cliente fuera de tu alcance'';\n    END IF;\n  END IF;');
  IF (length(d) - length(replace(d, 'AND (f.organization_id = public.org_scope())', ''))) / length('AND (f.organization_id = public.org_scope())') <> 2 THEN
    RAISE EXCEPTION 'M-9: se esperaban 2 filtros de org_scope()';
  END IF;
  d := replace(d, 'AND (f.organization_id = public.org_scope())', 'AND (v_org IS NULL OR f.organization_id = v_org)');
  EXECUTE d;
END $mig$;

-- ============ B-16: defaults de facturación sin papelera ============
DO $mig$
DECLARE d text; s text;
BEGIN
  d := pg_get_functiondef('public.obtener_defaults_facturacion_cliente(uuid)'::regprocedure);
  s := E'    AND f.organization_id = v_org\n    AND f.uuid_fiscal IS NOT NULL';
  IF position(s in d) = 0 THEN
    RAISE EXCEPTION 'B-16: patrón no encontrado en obtener_defaults_facturacion_cliente';
  END IF;
  d := replace(d, s, E'    AND f.organization_id = v_org\n    AND f.deleted_at IS NULL\n    AND f.uuid_fiscal IS NOT NULL');
  d := replace(d, 'JOIN public.facturas f ON f.id = fe.factura_id',
                  'JOIN public.facturas f ON f.id = fe.factura_id AND f.deleted_at IS NULL');
  d := replace(d, 'JOIN public.facturas f2 ON f2.id = fe2.factura_id',
                  'JOIN public.facturas f2 ON f2.id = fe2.factura_id AND f2.deleted_at IS NULL');
  EXECUTE d;
END $mig$;

-- ============ B-6: traspaso no puede exceder el saldo origen ============
DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.registrar_traspaso_bancario(uuid,uuid,date,numeric,numeric,numeric,text,text,uuid)'::regprocedure);
  IF position('  v_org_eff := COALESCE(v_org, v_origen.organization_id);' in d) = 0
     OR position('  v_concepto text := COALESCE' in d) = 0 THEN
    RAISE EXCEPTION 'B-6: patrón no encontrado en registrar_traspaso_bancario';
  END IF;
  d := replace(d, E'  v_concepto text := COALESCE', E'  v_saldo_origen numeric;\n  v_concepto text := COALESCE');
  d := replace(d, E'  v_org_eff := COALESCE(v_org, v_origen.organization_id);',
    E'  -- B-6 (v14): monto + comisión no pueden exceder el saldo de la cuenta origen.\n  v_saldo_origen := public.saldo_cuenta_bancaria(p_cuenta_origen_id);\n  IF v_saldo_origen IS NOT NULL\n     AND ROUND(p_monto_origen, 2) + ROUND(v_comision, 2) > ROUND(v_saldo_origen, 2) + 0.005 THEN\n    RAISE EXCEPTION ''LC_TRASPASO_SALDO_INSUFICIENTE: el saldo de la cuenta origen (%) no cubre el traspaso más la comisión (%).'',\n      ROUND(v_saldo_origen, 2), ROUND(p_monto_origen, 2) + ROUND(v_comision, 2)\n      USING ERRCODE = ''22023'';\n  END IF;\n  v_org_eff := COALESCE(v_org, v_origen.organization_id);');
  EXECUTE d;
END $mig$;

-- ============ B-9: espejo en BD de FE-03 (fecha de pago >= emisión) ============
CREATE OR REPLACE FUNCTION public._assert_fecha_pago_no_previa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_emision date;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.fecha_pago IS NULL OR NEW.factura_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT f.fecha_emision INTO v_emision FROM public.facturas f WHERE f.id = NEW.factura_id;
  IF v_emision IS NOT NULL AND NEW.fecha_pago < v_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA: la fecha del pago (%) no puede ser anterior a la emisión de la factura (%).',
      NEW.fecha_pago, v_emision USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public._assert_fecha_pago_no_previa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_fecha_pago_no_previa() FROM anon;
REVOKE ALL ON FUNCTION public._assert_fecha_pago_no_previa() FROM authenticated;
GRANT ALL ON FUNCTION public._assert_fecha_pago_no_previa() TO service_role;
DROP TRIGGER IF EXISTS trg_pago_fecha_no_previa ON public.pagos_factura;
CREATE TRIGGER trg_pago_fecha_no_previa
BEFORE INSERT OR UPDATE OF fecha_pago, factura_id ON public.pagos_factura
FOR EACH ROW EXECUTE FUNCTION public._assert_fecha_pago_no_previa();

-- ============ B-17: folios únicos parciales (ignoran papelera) ============
DROP INDEX IF EXISTS public.uq_cotizaciones_org_folio;
CREATE UNIQUE INDEX uq_cotizaciones_org_folio
  ON public.cotizaciones USING btree (organization_id, folio)
  WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS public.uq_traspasos_folio_org;
CREATE UNIQUE INDEX uq_traspasos_folio_org
  ON public.traspasos_bancarios USING btree (organization_id, folio)
  WHERE deleted_at IS NULL;