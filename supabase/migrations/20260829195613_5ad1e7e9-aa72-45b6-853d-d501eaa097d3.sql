-- Re-auditoría v15 · Olas 7 y 8 (base de datos)
-- M-8: `a_mxn` exige tipo de cambio > 1 (espejo de `tcConfiable`): 1 es
--      sentinela y <= 0 es dedazo, así que se devuelve NULL en vez de 1:1.
-- N-1: `_crear_embarque_replicar_conceptos` deja de clamar cantidades
--      fraccionarias (GREATEST(...,1) -> COALESCE(...,1)).
-- M-10: nueva regla de auditoría `contenedores_totales_descuadrados`.
-- M-14: banda de plausibilidad del T/C (5-40) en pagos CxC/CxP vía trigger.
--       No se usa CHECK porque hay historia con T/C = 1 en pagos USD.
-- M-15: `credito_en_uso_mxn` para validar crédito desde el servidor (timbrado).
-- B-6: el guard de saldo de traspasos deja de ser fail-open con saldo NULL.
-- B-12: `crear_embarque_completo` rechaza peso/volumen/piezas negativos.

-- ── M-8 ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.a_mxn(p_monto numeric, p_moneda text, p_usd_mxn numeric, p_eur_mxn numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL THEN NULL
    WHEN p_moneda = 'MXN' THEN p_monto
    -- M-8: > 1 (no > 0). En México el T/C se maneja como pesos por dólar/euro,
    -- así que 1 o menos nunca es un tipo de cambio real.
    WHEN p_moneda = 'USD' AND COALESCE(p_usd_mxn, 0) > 1 THEN round(p_monto * p_usd_mxn, 4)
    WHEN p_moneda = 'EUR' AND COALESCE(p_eur_mxn, 0) > 1 THEN round(p_monto * p_eur_mxn, 4)
    ELSE NULL
  END
$function$;

-- ── N-1 ───────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public._crear_embarque_replicar_conceptos(uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
  v_old text := 'GREATEST(COALESCE((v_venta->>''cantidad'')::numeric, 1), 1)';
  v_new text := 'COALESCE(NULLIF((v_venta->>''cantidad'')::numeric, 0), 1)';
BEGIN
  IF position(v_old in v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  END IF;
END
$do$;

-- ── M-10 ──────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public._audit_embarques_agregar(jsonb,jsonb)'::regprocedure);
  v_old text := '''venta_total_descuadrado'',       COUNT(*) FILTER (WHERE h->>''regla'' = ''venta_total_descuadrado'')';
BEGIN
  IF position('contenedores_totales_descuadrados' in v_def) = 0 THEN
    IF position(v_old in v_def) = 0 THEN
      RAISE EXCEPTION 'M-10: no se encontró el ancla de venta_total_descuadrado en _audit_embarques_agregar';
    END IF;
    EXECUTE replace(v_def, v_old, v_old || ',
      ''contenedores_totales_descuadrados'', COUNT(*) FILTER (WHERE h->>''regla'' = ''contenedores_totales_descuadrados'')');
  END IF;
END
$do$;

DO $do$
DECLARE
  v_def text := pg_get_functiondef('public.auditoria_embarques_org(uuid)'::regprocedure);
  v_cte text := '  emb_sin_tc AS (';
  v_union text := '    UNION ALL SELECT h FROM hall_venta_descuadrada';
  v_nuevo text;
BEGIN
  IF position('contenedores_totales_descuadrados' in v_def) > 0 THEN
    RETURN;
  END IF;
  IF position(v_cte in v_def) = 0 OR position(v_union in v_def) = 0 THEN
    RAISE EXCEPTION 'M-10: no se encontraron las anclas en auditoria_embarques_org';
  END IF;

  -- M-10: la carátula del embarque debe cuadrar con la suma de sus
  -- contenedores (como la factura de una mudanza contra las cajas reales).
  v_nuevo := '  contenedores_descuadrados AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           COUNT(ec.id) AS n_cont,
           ABS(COALESCE(e.peso_kg, 0) - COALESCE(SUM(ec.peso_kg), 0)) AS dif_peso,
           ABS(COALESCE(e.piezas, 0) - COALESCE(SUM(ec.piezas), 0)) AS dif_piezas
    FROM embarques e
    JOIN embarque_contenedores ec ON ec.embarque_id = e.id AND ec.deleted_at IS NULL
    WHERE e.organization_id = p_organization_id
      AND e.deleted_at IS NULL
      AND e.estado <> ''Cancelado''
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta, e.peso_kg, e.piezas
    HAVING (COALESCE(e.peso_kg, 0) > 0 AND COALESCE(SUM(ec.peso_kg), 0) > 0
            AND ABS(COALESCE(e.peso_kg, 0) - SUM(ec.peso_kg)) > GREATEST(1, COALESCE(e.peso_kg, 0) * 0.01))
        OR (COALESCE(e.piezas, 0) > 0 AND COALESCE(SUM(ec.piezas), 0) > 0
            AND COALESCE(e.piezas, 0) <> SUM(ec.piezas))
  ),
  hall_contenedores_descuadrados AS (
    SELECT jsonb_build_object(
      ''embarque_id'', cd.embarque_id, ''expediente'', cd.expediente,
      ''cliente_nombre'', cd.cliente_nombre, ''modo'', cd.modo::text,
      ''estado'', cd.estado::text, ''eta'', cd.eta,
      ''regla'', ''contenedores_totales_descuadrados'', ''severidad'', ''medio'',
      ''detalle'', ''Los totales del embarque no cuadran con la suma de sus '' || cd.n_cont
        || '' contenedor(es): diferencia de '' || to_char(cd.dif_peso, ''FM999,999,990.00'')
        || '' kg y '' || cd.dif_piezas || '' pieza(s)'',
      ''documentos_faltantes'', ''[]''::jsonb
    ) AS h
    FROM contenedores_descuadrados cd
  ),
' || v_cte;

  v_def := replace(v_def, v_cte, v_nuevo);
  v_def := replace(v_def, v_union, v_union || '
    UNION ALL SELECT h FROM hall_contenedores_descuadrados');
  EXECUTE v_def;
END
$do$;

-- ── M-14 ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._assert_tc_banda()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
BEGIN
  v_tc := CASE WHEN TG_TABLE_NAME = 'pagos_proveedor' THEN NEW.tipo_cambio_usd ELSE NEW.tipo_cambio END;
  IF NEW.moneda::text <> 'MXN' AND v_tc IS NOT NULL AND (v_tc < 5 OR v_tc > 40) THEN
    RAISE EXCEPTION 'LC_TC_FUERA_DE_BANDA: el tipo de cambio % no es plausible (se esperan entre 5 y 40 pesos por dólar/euro).', v_tc
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM anon;
REVOKE ALL ON FUNCTION public._assert_tc_banda() FROM authenticated;

DROP TRIGGER IF EXISTS trg_tc_banda_pagos_factura ON public.pagos_factura;
CREATE TRIGGER trg_tc_banda_pagos_factura
  BEFORE INSERT OR UPDATE OF tipo_cambio, moneda ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public._assert_tc_banda();

DROP TRIGGER IF EXISTS trg_tc_banda_pagos_proveedor ON public.pagos_proveedor;
CREATE TRIGGER trg_tc_banda_pagos_proveedor
  BEFORE INSERT OR UPDATE OF tipo_cambio_usd, moneda ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public._assert_tc_banda();

-- ── M-15 ──────────────────────────────────────────────────────────────────
-- Exposición de crédito SIN checks de sesión, para que la edge de timbrado
-- (service_role) pueda validarla antes de emitir.
CREATE OR REPLACE FUNCTION public.credito_en_uso_mxn(p_cliente_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH fc AS (
    SELECT f.id, f.total, f.moneda::text AS moneda, COALESCE(NULLIF(f.tipo_cambio, 0), 1) AS tc
    FROM public.facturas f
    WHERE f.cliente_id = p_cliente_id
      AND f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida', 'Vencida', 'Parcialmente pagada')
  ),
  pagos AS (
    SELECT p.factura_id, COALESCE(SUM(p.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura p
    WHERE p.deleted_at IS NULL AND p.factura_id IN (SELECT id FROM fc)
    GROUP BY p.factura_id
  ),
  ncs AS (
    SELECT n.factura_id, COALESCE(SUM(n.monto), 0) AS nc
    FROM public.factura_notas_credito n
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
      AND n.factura_id IN (SELECT id FROM fc)
    GROUP BY n.factura_id
  )
  SELECT ROUND(COALESCE(SUM(
    GREATEST(0, COALESCE(fc.total, 0) - COALESCE(p.pagado, 0) - COALESCE(n.nc, 0))
      * CASE WHEN fc.moneda = 'MXN' THEN 1 ELSE fc.tc END
  ), 0), 2)
  FROM fc
  LEFT JOIN pagos p ON p.factura_id = fc.id
  LEFT JOIN ncs n ON n.factura_id = fc.id
$function$;

REVOKE ALL ON FUNCTION public.credito_en_uso_mxn(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credito_en_uso_mxn(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.credito_en_uso_mxn(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credito_en_uso_mxn(uuid) TO service_role;

-- ── B-12 ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._assert_medidas_embarque(p_embarque jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE((p_embarque->>'peso_kg')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'LC_EMBARQUE_PESO_INVALIDO: el peso no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((p_embarque->>'volumen_m3')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'LC_EMBARQUE_VOLUMEN_INVALIDO: el volumen no puede ser negativo' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((p_embarque->>'piezas')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'LC_EMBARQUE_PIEZAS_INVALIDO: las piezas no pueden ser negativas' USING ERRCODE = '22023';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_medidas_embarque(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_medidas_embarque(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public._assert_medidas_embarque(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_medidas_embarque(jsonb) TO service_role;

DO $do$
DECLARE
  r record;
  v_def text;
  v_old text := 'BEGIN
  v_resp := public.idempotency_claim(p_request_id, ''crear_embarque_completo'');';
  v_new text := 'BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
  v_resp := public.idempotency_claim(p_request_id, ''crear_embarque_completo'');';
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'crear_embarque_completo'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('_assert_medidas_embarque' in v_def) = 0 THEN
      IF position(v_old in v_def) = 0 THEN
        RAISE EXCEPTION 'B-12: no se encontró el ancla en crear_embarque_completo (oid %)', r.oid;
      END IF;
      EXECUTE replace(v_def, v_old, v_new);
    END IF;
  END LOOP;
END
$do$;

-- ── B-6 ───────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  v_def text := pg_get_functiondef('public.registrar_traspaso_bancario(uuid,uuid,date,numeric,numeric,numeric,text,text,uuid)'::regprocedure);
  v_old text := 'v_saldo_origen := public.saldo_cuenta_bancaria(p_cuenta_origen_id);
  IF v_saldo_origen IS NOT NULL
     AND ROUND(p_monto_origen, 2)';
  v_new text := 'v_saldo_origen := COALESCE(public.saldo_cuenta_bancaria(p_cuenta_origen_id), 0);
  IF ROUND(p_monto_origen, 2)';
BEGIN
  IF position(v_old in v_def) > 0 THEN
    EXECUTE replace(v_def, v_old, v_new);
  END IF;
END
$do$;
