-- AUD109/111: sólo PostgreSQL efímero; todos los fixtures nuevos se revierten.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- Se simulan lecturas de históricos, incluidos tipos de cambio no verificables.
-- Replica es LOCAL a esta transacción y se restaura antes de invocar la RPC.
CREATE OR REPLACE FUNCTION pg_temp.seed_ec_history(
  p_org uuid, p_cliente uuid, p_moneda public.moneda, p_tc numeric, p_estado public.estado_factura,
  p_moneda_pago public.moneda, p_tc_pago numeric, p_monto numeric, p_aplicado numeric,
  p_rep text DEFAULT 'NoAplica', p_pago_borrado boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql AS $seed$
DECLARE
  v_factura uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  INSERT INTO public.facturas(id, numero, organization_id, cliente_id, cliente_nombre,
    moneda, tipo_cambio, subtotal, total, estado, fecha_emision, fecha_vencimiento, metodo_pago)
  VALUES (v_factura, 'AUD109-' || v_factura::text, p_org, p_cliente, 'AUD109/111',
    p_moneda, p_tc, 10, 10, p_estado, CURRENT_DATE - 40, CURRENT_DATE - 10, 'PPD');
  IF p_moneda_pago IS NOT NULL THEN
    INSERT INTO public.pagos_factura(organization_id, factura_id, fecha_pago, moneda, tipo_cambio,
      monto, monto_aplicado_factura, forma_pago, estado_rep, deleted_at)
    VALUES (p_org, v_factura, CURRENT_DATE, p_moneda_pago, p_tc_pago,
      p_monto, p_aplicado, '03', p_rep, CASE WHEN p_pago_borrado THEN now() ELSE NULL END);
  END IF;
  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN v_factura;
END;
$seed$;

DO $tests$
DECLARE
  fx record;
  cli uuid;
  cli_ajeno uuid := gen_random_uuid();
  cli_eur uuid := gen_random_uuid();
  portal uuid := gen_random_uuid();
  f uuid;
  caso record;
  res jsonb;
  clave text;
  rechazo boolean := false;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD109_111');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (cli_eur, fx.org_a, 'AUD111 EUR', 'XAXX010101000', 'eur@example.invalid'),
    (cli_ajeno, fx.org_b, 'AUD111 ajeno', 'XAXX010101000', 'ajeno@example.invalid');

  -- Todas las rutas del conversor vigente; los excesos permanecen en moneda
  -- de factura. MXN20/TC20-USD1 debe ser cero, nunca USD399.
  FOR caso IN SELECT * FROM (VALUES
    ('USD',18::numeric,'MXN',20::numeric,20::numeric,1::numeric,0::numeric),
    ('USD',18,'MXN',20,30,1,0.5),
    ('MXN',1,'USD',20,2,1,39),
    ('EUR',20,'MXN',25,30,1,0.5),
    ('MXN',1,'EUR',22,2,1,43),
    ('EUR',25,'USD',20,2,1,0.6),
    ('USD',20,'EUR',25,2,1,1.5),
    ('EUR',NULL,'EUR',1,3,1,2),
    ('USD',18,'MXN',1,20,1,0),
    ('USD',18,'MXN',0.05,20,1,0),
    ('USD',18,'MXN','NaN'::numeric,20,1,0),
    ('USD',18,'MXN','Infinity'::numeric,20,1,0),
    ('EUR',NULL,'MXN',20,20,1,0),
    ('EUR',1,'USD',20,20,1,0),
    ('EUR',25,'USD','NaN'::numeric,20,1,0)
  ) AS v(moneda, tc_factura, moneda_pago, tc_pago, monto, aplicado, esperado) LOOP
    cli := gen_random_uuid();
    INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
    VALUES (cli, fx.org_a, 'AUD109 caso', 'XAXX010101000', cli::text || '@example.invalid');
    f := pg_temp.seed_ec_history(fx.org_a, cli, caso.moneda::public.moneda, caso.tc_factura,
      'Emitida', caso.moneda_pago::public.moneda, caso.tc_pago, caso.monto, caso.aplicado);
    PERFORM pg_temp.as_user(fx.admin_a);
    res := public.estado_cuenta_agregados(ARRAY[cli]);
    clave := 'a_favor_' || lower(caso.moneda);
    PERFORM pg_temp.assert(COALESCE((res->>clave)::numeric = caso.esperado, false),
      'AUD109 ' || caso.moneda_pago || '->' || caso.moneda || ' TC=' || caso.tc_pago
      || ': esperado ' || caso.esperado || ', recibido ' || COALESCE(res->>clave, 'NULL'));
    PERFORM pg_temp.as_postgres();
  END LOOP;

  -- Control exacto con triggers reales: el pago válido no crea anticipos.
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, origen)
  VALUES (CURRENT_DATE, 18.1903, 20.4368, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = EXCLUDED.usd_mxn, eur_mxn = EXCLUDED.eur_mxn;
  cli := gen_random_uuid();
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'AUD109 liquidación', 'XAXX010101000', 'exacto@example.invalid');
  INSERT INTO public.facturas(id, numero, organization_id, cliente_id, cliente_nombre,
    moneda, tipo_cambio, subtotal, total, estado, fecha_emision, fecha_vencimiento, metodo_pago)
  VALUES (gen_random_uuid(), 'AUD109-EXACTO', fx.org_a, cli, 'AUD109 liquidación',
    'USD', 18.1903, 1, 1, 'Emitida', CURRENT_DATE, CURRENT_DATE + 30, 'PPD') RETURNING id INTO f;
  INSERT INTO public.pagos_factura(organization_id, factura_id, fecha_pago, moneda, tipo_cambio,
    monto, monto_aplicado_factura, forma_pago)
  VALUES (fx.org_a, f, CURRENT_DATE, 'MXN', 20, 20, 1, '03');
  PERFORM pg_temp.as_user(fx.admin_a);
  res := public.estado_cuenta_agregados(ARRAY[cli]);
  PERFORM pg_temp.assert((res->>'adeudado_usd')::numeric = 0 AND (res->>'a_favor_usd')::numeric = 0,
    'AUD109: liquidación MXN20/TC20→USD1 sin deuda ni anticipo');
  PERFORM pg_temp.as_postgres();

  -- EUR con deuda vencida; pagos anulados/borrados y facturas inactivas nunca
  -- generan anticipos. Pagada con REP cancelado reabre el saldo canónico.
  PERFORM pg_temp.seed_ec_history(fx.org_a, cli_eur, 'EUR', 20, 'Pagada', 'MXN', 20, 200, 1, 'Cancelado');
  PERFORM pg_temp.seed_ec_history(fx.org_a, cli_eur, 'EUR', 20, 'Emitida', 'MXN', 20, 200, 1, 'NoAplica', true);
  PERFORM pg_temp.seed_ec_history(fx.org_a, cli_eur, 'EUR', 20, 'Cancelada', 'MXN', 20, 200, 1);
  PERFORM pg_temp.seed_ec_history(fx.org_a, cli_eur, 'EUR', 20, 'Borrador', 'MXN', 20, 200, 1);
  PERFORM pg_temp.seed_ec_history(fx.org_b, cli_ajeno, 'EUR', 20, 'Emitida', NULL, NULL, NULL, NULL);
  PERFORM pg_temp.as_user(fx.admin_a);
  res := public.estado_cuenta_agregados(ARRAY[cli_eur, cli_ajeno]);
  PERFORM pg_temp.assert((res->>'adeudado_eur')::numeric = 20 AND (res->>'vencido_eur')::numeric = 20
    AND (res->>'a_favor_eur')::numeric = 0 AND (res->>'facturas_adeudadas')::int = 2
    AND (res->>'facturas_vencidas')::int = 2,
    'AUD111: EUR en totales y conteos, sin anticipos cancelados/borrados/inactivos/ajenos');
  res := public.estado_cuenta_agregados(ARRAY[cli_eur], CURRENT_DATE - 5, CURRENT_DATE);
  PERFORM pg_temp.assert((res->>'adeudado_eur')::numeric = 0 AND (res->>'a_favor_eur')::numeric = 0,
    'AUD111: rango de emisión conserva el mismo alcance en deuda y anticipos');
  PERFORM pg_temp.as_user(fx.admin_b);
  res := public.estado_cuenta_agregados(ARRAY[cli_eur]);
  PERFORM pg_temp.assert((res->>'facturas_adeudadas')::int = 0 AND (res->>'adeudado_eur')::numeric = 0,
    'AUD111: no amplía acceso entre organizaciones');
  PERFORM pg_temp.as_postgres();

  -- Portal: mantiene el acceso sólo al cliente vinculado y rechaza otros IDs.
  INSERT INTO auth.users(id, email) VALUES (portal, 'aud111-portal@example.invalid');
  INSERT INTO public.client_users(user_id, cliente_id, organization_id) VALUES (portal, cli_eur, fx.org_a);
  PERFORM pg_temp.as_user(portal);
  res := public.estado_cuenta_agregados(ARRAY[cli_eur]);
  PERFORM pg_temp.assert((res->>'adeudado_eur')::numeric = 20, 'AUD111: portal conserva EUR de su cliente');
  BEGIN
    PERFORM public.estado_cuenta_agregados(ARRAY[cli_ajeno]);
  EXCEPTION WHEN raise_exception THEN
    rechazo := SQLERRM LIKE 'LC_ESTADO_CUENTA_SIN_ACCESO:%';
  END;
  PERFORM pg_temp.assert(rechazo, 'AUD111: portal rechaza cliente no vinculado');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated', 'public.estado_cuenta_agregados(uuid[],date,date)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.estado_cuenta_agregados(uuid[],date,date)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.estado_cuenta_agregados(uuid[],date,date)', 'EXECUTE'),
    'AUD109/111: conserva privilegios vigentes');
END;
$tests$;
ROLLBACK;
