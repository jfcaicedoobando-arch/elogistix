-- Auditoría 21. Preview y persistencia usan el mismo TC positivo explícito.
-- Ejecutar sólo en PostgreSQL efímero; sin reparar NC históricas.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_org uuid := gen_random_uuid();
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_factura uuid := gen_random_uuid();
  v_fecha date := public.fecha_negocio_mx() - 42;
  v_nc public.proveedor_notas_credito;
  v_tc numeric;
  v_invalido numeric;
  v_error text;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'AUD21 NC TC');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'AUD21 PROVEEDOR', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (v_cat, v_org, 'AUD21 CATEGORIA');
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, subtotal, total, estado, estado_aprobacion
  ) VALUES (v_factura, v_org, v_prov, v_cat, 'AUD21-' || gen_random_uuid(),
            v_fecha, 'USD', 1000, 1000, 'Vigente', 'aprobada');
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
  VALUES (v_fecha, 18.1903, 20, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 18.1903, eur_mxn = 20;

  FOREACH v_tc IN ARRAY ARRAY[0.5, 1, 20]::numeric[] LOOP
    INSERT INTO public.proveedor_notas_credito(
      organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
    ) VALUES (v_org, v_factura, v_fecha, 1, 'MXN', v_tc) RETURNING * INTO v_nc;
    PERFORM pg_temp.assert(v_nc.tipo_cambio IS NOT DISTINCT FROM v_tc,
      'AUD21: TC explícito ' || v_tc || ' fue sustituido');
    PERFORM pg_temp.assert(
      public.monto_pago_en_moneda_factura(v_nc.monto, v_nc.moneda::text, v_nc.tipo_cambio, 'USD')
        IS NOT DISTINCT FROM round(1 / v_tc, 4),
      'AUD21: el importe equivalente guardado no coincide con el preview');
  END LOOP;

  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
  ) VALUES (v_org, v_factura, v_fecha, 1, 'MXN', NULL) RETURNING * INTO v_nc;
  PERFORM pg_temp.assert(v_nc.tipo_cambio IS NOT DISTINCT FROM 18.1903,
    'AUD21: sólo TC omitido debe resolver DOF');

  FOREACH v_invalido IN ARRAY ARRAY[0, -1, 'NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric] LOOP
    BEGIN
      INSERT INTO public.proveedor_notas_credito(
        organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
      ) VALUES (v_org, v_factura, v_fecha, 1, 'MXN', v_invalido);
      RAISE EXCEPTION 'AUD21: se aceptó TC explícito inválido %', v_invalido;
    EXCEPTION WHEN invalid_parameter_value THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      PERFORM pg_temp.assert(v_error LIKE 'LC_NC_PROV_TC_INVALIDO%', 'AUD21: error inesperado ' || v_error);
    END;
  END LOOP;

  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
  ) VALUES (v_org, v_factura, v_fecha, 1, 'USD', 0.5) RETURNING * INTO v_nc;
  PERFORM pg_temp.assert(v_nc.tipo_cambio IS NULL, 'AUD21: misma moneda debe conservar TC no aplicable');

  BEGIN
    INSERT INTO public.proveedor_notas_credito(
      organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
    ) VALUES (v_org, v_factura, v_fecha, 1, 'EUR', 0.5);
    RAISE EXCEPTION 'AUD21: se admitió cruce USD/EUR no soportado';
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_NC_PROV_MONEDA_NO_CONVERTIBLE%', 'AUD21: cruce dio error inesperado');
  END;
  BEGIN
    INSERT INTO public.proveedor_notas_credito(
      organization_id, proveedor_factura_id, fecha, monto, moneda, tipo_cambio
    ) VALUES (v_org, v_factura, DATE '0001-01-01', 1, 'MXN', NULL);
    RAISE EXCEPTION 'AUD21: se admitió NC sin TC ni DOF';
  EXCEPTION WHEN invalid_parameter_value THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_NC_PROV_TC_REQUERIDO%', 'AUD21: falta de DOF dio error inesperado');
  END;
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD21: TC explícito, DOF omitido, precisión y validaciones conservados';
END;
$tests$;

ROLLBACK;
