-- Lote C21–C25 (v13.823.380) · candados preventivos en la BASE.
-- Sólo lectura sobre el catálogo (contratos de las funciones): no inserta
-- datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  -- C21: una cotización YA vinculada a un embarque vivo devuelve ese embarque
  -- sin revalidar tarifa ni reaplicar costos, pero conservando los controles
  -- de acceso y el FOR UPDATE de concurrencia.
  v_def := pg_get_functiondef('public.crear_embarque_borrador_desde_cotizacion(uuid,text,uuid,jsonb)'::regprocedure);
  IF v_def !~ 'FROM public\.cotizaciones WHERE id=p_cotizacion_id FOR UPDATE' THEN
    RAISE EXCEPTION 'C21 FAIL: se perdió el FOR UPDATE sobre la cotización';
  END IF;
  IF v_def !~ 'v_existente IS NOT NULL' OR v_def !~ 'RETURN v_existente' THEN
    RAISE EXCEPTION 'C21 FAIL: la llamada repetida volvió a caer en el flujo de creación/decisión';
  END IF;
  IF position('RETURN v_existente' in v_def) > position('revalidar_tarifa_cotizacion' in v_def) THEN
    RAISE EXCEPTION 'C21 FAIL: el reintento revalida tarifa antes de devolver el embarque existente';
  END IF;
  IF position('RETURN v_existente' in v_def) > position('PERFORM public._embarque_aplicar_tarifa_decidida' in v_def) THEN
    RAISE EXCEPTION 'C21 FAIL: el reintento puede reaplicar la tarifa a un embarque existente';
  END IF;
  IF v_def !~ 'LC_NO_AUTORIZADO' OR v_def !~ 'current_user_org_id' THEN
    RAISE EXCEPTION 'C21 FAIL: el retorno idempotente no verifica organización ni rol';
  END IF;

  -- C22: `aplica_iva = false` nunca persiste tasa > 0, ni en alta ni en edición.
  v_def := pg_get_functiondef('public.actualizar_embarque_completo(uuid,jsonb,jsonb,jsonb,uuid,timestamptz)'::regprocedure);
  IF v_def ~ 'tasa_iva_aplicada = COALESCE\(\(cv->>''tasa_iva_aplicada''\)::numeric, tasa_iva_aplicada\)' THEN
    RAISE EXCEPTION 'C22 FAIL: la edición volvió a conservar la tasa legacy en líneas exentas';
  END IF;
  IF v_def !~ 'WHEN COALESCE\(\(cv->>''aplica_iva''\)::boolean, aplica_iva\) = false THEN 0' THEN
    RAISE EXCEPTION 'C22 FAIL: falta la normalización de tasa en la edición de conceptos de venta';
  END IF;
  IF v_def !~ 'WHEN COALESCE\(\(cv->>''aplica_iva''\)::boolean, false\) = false THEN 0' THEN
    RAISE EXCEPTION 'C22 FAIL: falta la normalización de tasa en el alta de conceptos de venta';
  END IF;
  -- C28 (v13.823.381): el alta usa NULLIF(...,0) para que una tasa 0 explícita
  -- en una línea gravada caiga en el fallback canónico.
  IF v_def !~ 'ELSE COALESCE\(NULLIF\(\(cv->>''tasa_iva_aplicada''\)::numeric, 0\), 0\.16\)' THEN
    RAISE EXCEPTION 'C22 FAIL: el alta gravada perdió el fallback canónico de tasa';
  END IF;

  -- C23/C24: sincronización de contenedores.
  v_def := pg_get_functiondef('public.sincronizar_contenedores_embarque(uuid,jsonb)'::regprocedure);
  IF v_def !~ 'LC_CONTENEDOR_ID_INVALIDO' THEN
    RAISE EXCEPTION 'C23 FAIL: un id ajeno o soft-deleted vuelve a pasar sin validación';
  END IF;
  IF v_def !~ 'LC_CONTENEDOR_ID_DUPLICADO' THEN
    RAISE EXCEPTION 'C23 FAIL: la lista puede repetir el mismo contenedor';
  END IF;
  IF v_def !~ 'LC_CONTENEDOR_CON_CONCEPTOS' THEN
    RAISE EXCEPTION 'C24 FAIL: se puede quitar un contenedor con costos o ventas vivos';
  END IF;
  -- Las validaciones deben ir ANTES del borrado lógico (operación atómica).
  IF position('LC_CONTENEDOR_ID_INVALIDO' in v_def) > position('SET deleted_at = now()' in v_def) THEN
    RAISE EXCEPTION 'C23 FAIL: la validación de ids corre después del borrado lógico';
  END IF;
  IF position('LC_CONTENEDOR_CON_CONCEPTOS' in v_def) > position('SET deleted_at = now()' in v_def) THEN
    RAISE EXCEPTION 'C24 FAIL: el candado de conceptos corre después del borrado lógico';
  END IF;
  IF v_def !~ '_assert_writer' THEN
    RAISE EXCEPTION 'C23 FAIL: se perdió el control de escritura por organización';
  END IF;

  -- C25: fusión de proformas en Facturación.
  v_def := pg_get_functiondef('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)'::regprocedure);
  IF v_def !~ 'LC_PROFORMA_FUENTE_CONSOLIDADA' THEN
    RAISE EXCEPTION 'C25 FAIL: una proforma fuente ya consolidada puede facturarse';
  END IF;
  IF v_def !~ 'LC_PROFORMA_MEZCLA_CONSOLIDADA' THEN
    RAISE EXCEPTION 'C25 FAIL: se pueden mezclar proformas consolidadas con individuales';
  END IF;
  IF v_def !~ 'LC_PROFORMA_DIAS_CREDITO_DISTINTOS' THEN
    RAISE EXCEPTION 'C25 FAIL: una fusión con plazos de crédito distintos elige uno en silencio';
  END IF;
  -- Los tres candados deben resolverse antes de crear la factura.
  IF position('LC_PROFORMA_MEZCLA_CONSOLIDADA' in v_def) > position('INSERT INTO public.facturas' in v_def) THEN
    RAISE EXCEPTION 'C25 FAIL: el candado de mezcla corre después de crear la factura';
  END IF;
  IF position('LC_PROFORMA_FUENTE_CONSOLIDADA' in v_def) > position('INSERT INTO public.facturas' in v_def) THEN
    RAISE EXCEPTION 'C25 FAIL: el candado de fuente consolidada corre después de crear la factura';
  END IF;

  RAISE NOTICE 'C21–C25 OK: candados preventivos vigentes';
END $$;
