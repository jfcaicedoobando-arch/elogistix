-- Ola v16 · Regresión estructural: pulido Facturación → Cobranza → Pagos.
--
-- Ejecutar con:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola_v16_cobranza_pagos.sql
--
-- Falla (con RAISE) si:
--   (1) reasignar_pago_factura pierde el lock `FOR UPDATE`, vuelve a sumar
--       `monto` crudo de NC o regresa a la tolerancia 0.01.
--   (2) cobranza_listado / cobranza_agregados dejan de usar el canon
--       public._nc_aplicadas_moneda_factura (NC Timbrada/Aplicada).

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
  SELECT array_agg(esperado.nombre ORDER BY esperado.nombre) INTO v_falta
  FROM (VALUES ('cobranza_listado'), ('cobranza_agregados')) esperado(nombre)
  LEFT JOIN pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_proc p ON p.pronamespace = n.oid AND p.proname = esperado.nombre
  WHERE p.oid IS NULL
     OR pg_get_functiondef(p.oid) !~ 'public\._nc_aplicadas_moneda_factura\(';

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

-- El nombre del helper no basta: ambos estados efectivos deben reducir el saldo
-- real de los dos consumidores. Datos ordinarios, aislados y revertidos.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $nc_tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  fac uuid;
  estado_nc public.estado_nota_credito;
  cantidad integer := 0;
  hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('OLA16-NC');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'OLA16 NC', 'XAXX010101000', 'ola16-nc@example.invalid');
  FOREACH estado_nc IN ARRAY ARRAY['Timbrada', 'Aplicada']::public.estado_nota_credito[] LOOP
    PERFORM pg_temp.as_postgres();
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero,
      fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
    VALUES (fac, fx.org_a, cli, 'OLA16 NC', 'OLA16-NC-' || fac, hoy - 2, hoy - 1,
      'MXN', 1, 100, 0, 100, 'Emitida');
    INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda,
      tipo_cambio, fecha_emision, estado, uuid_fiscal, conceptos)
    VALUES (fx.org_a, fac, 'OLA16-NC-' || fac, 25, 'MXN', 1, hoy, estado_nc,
      gen_random_uuid()::text, '[{"descripcion":"Descuento global","cantidad":1,"precio_unitario":25,"total":25,"subtotal":25}]'::jsonb);
    cantidad := cantidad + 1;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert((SELECT saldo FROM public.cobranza_listado(cli) WHERE id = fac) IS NOT DISTINCT FROM 75::numeric,
      'OLA-V16: listado debe restar NC cliente ' || estado_nc);
    PERFORM pg_temp.assert((public.cobranza_agregados(cli)->>'total_mxn')::numeric IS NOT DISTINCT FROM 75::numeric * cantidad,
      'OLA-V16: agregado debe restar NC cliente ' || estado_nc);
  END LOOP;
END $nc_tests$;
ROLLBACK;
SELECT 'ola_v16_cobranza_pagos OK' AS resultado;
