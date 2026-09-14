-- Lote B16–B19 (v13.823.379) · reglas fiscales y de conversión en la BASE.
-- Sólo lectura sobre el catálogo: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  -- B16: proforma → factura. `aplica_iva = false` manda sobre una tasa legacy
  -- stale (0.16): la línea se clasifica exenta y su tasa se persiste NULL.
  v_def := pg_get_functiondef('public._convertir_proformas_insertar_conceptos(uuid,uuid[],uuid,boolean,moneda)'::regprocedure);
  IF v_def !~ 'CASE WHEN pcc\.aplica_iva = false THEN NULL' THEN
    RAISE EXCEPTION 'B16 FAIL: la rama consolidada volvió a gravar líneas exentas con una tasa legacy';
  END IF;
  IF v_def !~ 'CASE WHEN cv\.aplica_iva = false THEN NULL' THEN
    RAISE EXCEPTION 'B16 FAIL: la rama por conceptos_venta volvió a gravar líneas exentas con una tasa legacy';
  END IF;
  IF v_def ~ 'tasa_iva_aplicada IS NULL AND (pcc|cv)\.aplica_iva = false' THEN
    RAISE EXCEPTION 'B16 FAIL: regresó la condición que exigía tasa NULL para declarar exento';
  END IF;
  -- Contrato de la clasificación fiscal: (false, NULL) ⇒ exento.
  IF public._tipo_iva_desde_tasa(false, NULL) <> 'exento' THEN
    RAISE EXCEPTION 'B16 FAIL: _tipo_iva_desde_tasa dejó de clasificar exento';
  END IF;

  -- B18: una cotización informativa (tarifario) no puede generar operación.
  v_def := pg_get_functiondef('public._assert_cotizacion_venta_valida(uuid)'::regprocedure);
  IF v_def !~ 'LC_COT_INFORMATIVA' THEN
    RAISE EXCEPTION 'B18 FAIL: el candado canónico dejó de rechazar cotizaciones informativas';
  END IF;
  IF v_def ~ 'IF NOT FOUND OR v_tipo_doc = ''informativa'' THEN RETURN' THEN
    RAISE EXCEPTION 'B18 FAIL: regresó el RETURN temprano que dejaba convertir informativas';
  END IF;
  -- Ambas rutas de conversión pasan por el helper canónico.
  IF pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure)
       !~ '_assert_cotizacion_venta_valida' THEN
    RAISE EXCEPTION 'B18 FAIL: crear_embarque_borrador_core dejó de invocar el candado canónico';
  END IF;
  IF pg_get_functiondef('public._assert_cotizacion_convertible(uuid,uuid)'::regprocedure)
       !~ '_assert_cotizacion_venta_valida' THEN
    RAISE EXCEPTION 'B18 FAIL: el pre-check de convertibilidad dejó de invocar el candado canónico';
  END IF;

  -- B19: replicación cotización → embarque con la tasa canónica de la
  -- organización cuando la línea legacy declara aplica_iva sin tasa.
  v_def := pg_get_functiondef('public._crear_embarque_replicar_conceptos(uuid,uuid,uuid,uuid[],jsonb)'::regprocedure);
  IF v_def !~ 'v_tasa := 0\.16' THEN
    RAISE EXCEPTION 'B19 FAIL: una línea con aplica_iva = true y sin tasa vuelve a replicarse sin IVA';
  END IF;
  IF v_def ~ 'v_tasa := GREATEST\(COALESCE\(\(v_venta->>''tasa_iva_aplicada''\)::numeric, 0\), 0\)' THEN
    RAISE EXCEPTION 'B19 FAIL: regresó el fallback de tasa 0 para líneas legacy gravadas';
  END IF;
  IF v_def !~ 'IF NOT v_aplica THEN\s*\n?\s*v_tasa := 0;' THEN
    RAISE EXCEPTION 'B19 FAIL: una línea con aplica_iva = false debe replicarse con tasa 0';
  END IF;

  RAISE NOTICE 'B16–B19 OK: candados fiscales y de conversión vigentes';
END $$;
