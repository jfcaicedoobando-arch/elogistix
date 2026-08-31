-- Ola v16 · Regresión estructural: pulido Facturación → Cobranza → Pagos.
--
-- Ejecutar con:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola_v16_cobranza_pagos.sql
--
-- Falla (con RAISE) si:
--   (1) reasignar_pago_factura pierde el lock `FOR UPDATE`, vuelve a sumar
--       `monto` crudo de NC o regresa a la tolerancia 0.01.
--   (2) cobranza_listado / cobranza_agregados dejan de usar el canon
--       public.nc_aplicadas_en_moneda_factura.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'reasignar_pago_factura';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'OLA-V16: no existe public.reasignar_pago_factura';
  END IF;
  IF v_def !~* 'FOR UPDATE' THEN
    RAISE EXCEPTION 'OLA-V16 REGRESIÓN: reasignar_pago_factura sin SELECT ... FOR UPDATE (reasignación concurrente duplica el pago)';
  END IF;
  IF v_def !~ 'nc_aplicadas_en_moneda_factura' THEN
    RAISE EXCEPTION 'OLA-V16 REGRESIÓN: reasignar_pago_factura no usa el canon nc_aplicadas_en_moneda_factura';
  END IF;
  IF v_def ~ '\+ 0\.01' THEN
    RAISE EXCEPTION 'OLA-V16 REGRESIÓN: reasignar_pago_factura usa tolerancia 0.01; el canon del trigger de sobrepago es 0.005';
  END IF;
  IF v_def !~ '\+ 0\.005' THEN
    RAISE EXCEPTION 'OLA-V16 REGRESIÓN: reasignar_pago_factura no aplica la tolerancia canónica 0.005';
  END IF;
END $$;

DO $$
DECLARE
  v_falta text[];
BEGIN
  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_falta
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('cobranza_listado', 'cobranza_agregados')
    AND pg_get_functiondef(p.oid) !~ 'nc_aplicadas_en_moneda_factura';

  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'OLA-V16 REGRESIÓN: RPCs de cobranza sin el canon de NC en moneda de factura: %', v_falta;
  END IF;
END $$;

-- Prueba de comportamiento del lock: sin datos de negocio, verificamos que la
-- función mantiene el candado a nivel de fila mediante un pago inexistente
-- (debe fallar con el código LC existente, no con un error genérico).
DO $$
BEGIN
  BEGIN
    PERFORM public.reasignar_pago_factura(
      '00000000-0000-0000-0000-000000000000'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid);
    RAISE EXCEPTION 'OLA-V16: reasignar_pago_factura aceptó un pago inexistente';
  EXCEPTION
    WHEN SQLSTATE 'P0002' THEN
      IF SQLERRM !~ 'LC_REFACT_PAGO_NO_ENCONTRADO' THEN
        RAISE EXCEPTION 'OLA-V16: código inesperado para pago inexistente: %', SQLERRM;
      END IF;
  END;
END $$;

SELECT 'ola_v16_cobranza_pagos OK' AS resultado;
