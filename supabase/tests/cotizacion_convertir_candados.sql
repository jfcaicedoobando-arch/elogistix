-- Guard v13.823.330 · candados de conversión cotización → embarque y de
-- aceptación de cotización.
--
-- Vigila que:
--   * `crear_embarque_borrador_core` exija tipo de cambio cuando la cotización
--     mezcla monedas (LC_COT_TC_REQUERIDO) y número de contenedores en marítimo
--     FCL (LC_COT_CONTENEDORES_REQUERIDOS), y herede `tipo_cambio_usd`;
--   * `aceptar_cotizacion_version` no acepte cotizaciones transaccionales sin
--     importe (LC_COT_IMPORTE_REQUERIDO), dejando exentas las informativas.
--
-- Sólo lectura sobre pg_get_functiondef: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_core text;
  v_acep text;
BEGIN
  v_core := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);

  IF v_core !~ 'LC_COT_TC_REQUERIDO' THEN
    RAISE EXCEPTION 'la conversión dejó de exigir tipo de cambio en cotizaciones con monedas mezcladas';
  END IF;
  IF v_core !~ 'LC_COT_CONTENEDORES_REQUERIDOS' THEN
    RAISE EXCEPTION 'la conversión dejó de exigir el número de contenedores en marítimo FCL';
  END IF;
  IF v_core !~ 'tipo_cambio_usd' THEN
    RAISE EXCEPTION 'el embarque dejó de heredar el tipo de cambio de la cotización';
  END IF;

  v_acep := pg_get_functiondef('public.aceptar_cotizacion_version(uuid)'::regprocedure);

  IF v_acep !~ 'LC_COT_IMPORTE_REQUERIDO' THEN
    RAISE EXCEPTION 'la aceptación dejó de bloquear cotizaciones transaccionales sin importe';
  END IF;
  IF v_acep !~ 'informativa' THEN
    RAISE EXCEPTION 'la aceptación dejó de exentar a las cotizaciones informativas del candado de importe';
  END IF;
  -- El candado de importe corre DESPUÉS de la salida idempotente: una cotización
  -- ya aceptada no debe empezar a fallar por este candado.
  IF position('LC_COT_IMPORTE_REQUERIDO' in v_acep) < position('sin_cambios' in v_acep) THEN
    RAISE EXCEPTION 'el candado de importe se movió antes de la salida idempotente de aceptación';
  END IF;

  RAISE NOTICE 'OK cotizacion_convertir_candados';
END $$;
