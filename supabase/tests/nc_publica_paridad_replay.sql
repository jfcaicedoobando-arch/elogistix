-- Replay regression: the public NC helper must delegate to the existing canon.
-- Run only in the disposable PG 17.9 database prepared by the repository CI.
-- All fixtures and pg_temp helpers roll back; no trigger or RLS guard is disabled.
-- Missing-FX arithmetic belongs to the separate minimal replay reproduction:
-- the production invoice/NC guards intentionally prevent arbitrary such fixtures.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE TEMP TABLE nc_parity_function_before ON COMMIT DROP AS
SELECT p.oid, p.proname, p.proowner, p.proacl::text AS acl,
       p.proconfig, p.provolatile, p.prosecdef,
       encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex') AS definition_sha256
FROM pg_proc p
WHERE p.oid IN (
  'public.nc_aplicadas_en_moneda_factura(uuid)'::regprocedure,
  'public._nc_aplicadas_moneda_factura(uuid)'::regprocedure,
  'public._saldo_factura_calc(uuid)'::regprocedure
);

DO $catalog$
DECLARE
  wrapper record;
BEGIN
  SELECT p.* INTO STRICT wrapper FROM pg_proc p
  WHERE p.oid = 'public.nc_aplicadas_en_moneda_factura(uuid)'::regprocedure;
  PERFORM pg_temp.assert(wrapper.provolatile = 's' AND wrapper.prosecdef,
    'NC parity: public wrapper must remain STABLE SECURITY DEFINER');
  PERFORM pg_temp.assert(wrapper.proconfig IS NOT DISTINCT FROM ARRAY['search_path=public']::text[],
    'NC parity: public wrapper must retain its public search_path');
  PERFORM pg_temp.assert(pg_get_userbyid(wrapper.proowner) = 'postgres',
    'NC parity: public wrapper must retain its postgres owner');
  PERFORM pg_temp.assert(NOT EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(wrapper.proacl, acldefault('f', wrapper.proowner))) acl
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee NOT IN (wrapper.proowner, 'service_role'::regrole::oid)
  ), 'NC parity: public wrapper must not grant EXECUTE outside owner/service_role');
  PERFORM pg_temp.assert(has_function_privilege('postgres', wrapper.oid, 'EXECUTE')
    AND has_function_privilege('service_role', wrapper.oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', wrapper.oid, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', wrapper.oid, 'EXECUTE'),
    'NC parity: public wrapper must retain service-only direct access');
  -- Internal helper metadata differs between clean replay and installed DBs.
  -- Snapshot it above and compare below; this test does not authorize an ACL change.
END $catalog$;

CREATE OR REPLACE FUNCTION pg_temp.nc_parity_seed_invoice(
  p_org uuid, p_cliente uuid, p_label text, p_moneda public.moneda DEFAULT 'MXN'
) RETURNS uuid LANGUAGE plpgsql AS $fixture$
DECLARE
  fac uuid := gen_random_uuid();
  hoy date := public.fecha_negocio_mx();
BEGIN
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado, metodo_pago)
  VALUES (fac, p_org, p_cliente, 'NC parity fixture', 'NC-PARITY-' || p_label || '-' || fac,
    hoy, hoy + 30, p_moneda, 100, 0, 100, 'Borrador', 'PPD');
  INSERT INTO public.conceptos_factura(organization_id, factura_id, descripcion,
    cantidad, precio_unitario, total, moneda, tipo_iva, tasa_iva_aplicada)
  VALUES (p_org, fac, 'NC parity service', 1, 100, 100, p_moneda, 'tasa_0', 0);
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = fac;
  RETURN fac;
END $fixture$;

CREATE OR REPLACE FUNCTION pg_temp.nc_parity_seed_credit(
  p_org uuid, p_factura uuid, p_label text, p_monto numeric,
  p_moneda public.moneda, p_tc numeric, p_estado public.estado_nota_credito,
  p_deleted boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql AS $fixture$
DECLARE
  nc uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.factura_notas_credito(id, organization_id, factura_id, folio,
    monto, moneda, tipo_cambio, fecha_emision, estado, uuid_fiscal, conceptos, deleted_at)
  VALUES (nc, p_org, p_factura, 'NC-PARITY-' || p_label || '-' || nc,
    p_monto, p_moneda, p_tc, public.fecha_negocio_mx(), p_estado,
    CASE WHEN p_estado IN ('Timbrada', 'Aplicada') THEN nc::text END,
    jsonb_build_array(jsonb_build_object('descripcion', 'Global discount', 'cantidad', 1,
      'precio_unitario', p_monto, 'subtotal', p_monto, 'total', p_monto,
      'tipo_iva', 'tasa_0', 'tasa_iva', 0)),
    CASE WHEN p_deleted THEN now() END);
  RETURN nc;
END $fixture$;

CREATE OR REPLACE FUNCTION pg_temp.nc_parity_assert(
  p_factura uuid, p_credito numeric, p_saldo numeric, p_label text
) RETURNS void LANGUAGE plpgsql AS $check$
DECLARE
  invoice_before jsonb;
  credits_before jsonb;
  publico numeric;
  interno numeric;
  saldo numeric;
BEGIN
  SELECT to_jsonb(f) INTO invoice_before FROM public.facturas f WHERE f.id = p_factura;
  SELECT COALESCE(jsonb_agg(to_jsonb(nc) ORDER BY nc.id), '[]'::jsonb) INTO credits_before
  FROM public.factura_notas_credito nc WHERE nc.factura_id = p_factura;
  publico := public.nc_aplicadas_en_moneda_factura(p_factura);
  interno := public._nc_aplicadas_moneda_factura(p_factura);
  saldo := public._saldo_factura_calc(p_factura);
  PERFORM pg_temp.assert(publico IS NOT DISTINCT FROM p_credito
    AND interno IS NOT DISTINCT FROM p_credito
    AND publico IS NOT DISTINCT FROM interno,
    format('NC parity %s: expected credit=%s, public=%s, internal=%s',
      p_label, p_credito, publico, interno));
  PERFORM pg_temp.assert(saldo IS NOT DISTINCT FROM p_saldo
    AND public.saldo_factura(p_factura) IS NOT DISTINCT FROM p_saldo,
    format('NC parity %s: expected balance=%s, canonical=%s', p_label, p_saldo, saldo));
  PERFORM pg_temp.assert((SELECT to_jsonb(f) FROM public.facturas f WHERE f.id = p_factura)
      IS NOT DISTINCT FROM invoice_before
    AND (SELECT COALESCE(jsonb_agg(to_jsonb(nc) ORDER BY nc.id), '[]'::jsonb)
         FROM public.factura_notas_credito nc WHERE nc.factura_id = p_factura)
      IS NOT DISTINCT FROM credits_before,
    'NC parity ' || p_label || ': balance reads must preserve persisted facts');
END $check$;

DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  fac uuid;
  fac_usd uuid;
  fac_eur uuid;
  nc uuid;
  terminal uuid;
  hoy date := public.fecha_negocio_mx();
BEGIN
  PERFORM pg_temp.as_postgres();
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('NC_PARITY_REPLAY');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'NC parity fixture', 'XAXX010101000', 'nc-parity@example.invalid');
  -- Ordinary local reference data for the DOF guard: the invoice guard resolves
  -- its own rate, rather than accepting a caller-supplied bypass or captured TC.
  INSERT INTO public.tipos_cambio_dof(fecha, usd_mxn, eur_mxn, fuente, origen)
  VALUES (hoy, 20, 22, 'nc_parity_fixture', 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = EXCLUDED.usd_mxn,
    eur_mxn = EXCLUDED.eur_mxn, fuente = EXCLUDED.fuente, origen = EXCLUDED.origen;

  fac := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'MXN-LIFECYCLE');
  PERFORM pg_temp.nc_parity_assert(fac, 0, 100, 'no credit');
  nc := pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'TIMBRADA', 25, 'MXN', 1, 'Timbrada');
  PERFORM pg_temp.nc_parity_assert(fac, 25, 75, 'Timbrada25 / invoice100');

  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'BORRADOR', 7, 'MXN', 1, 'Borrador');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'CANCELADA', 9, 'MXN', 1, 'Cancelada');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'DELETED', 11, 'MXN', 1, 'Timbrada', true);
  PERFORM pg_temp.nc_parity_assert(fac, 25, 75, 'Borrador/Cancelada/deleted excluded');

  UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = nc;
  PERFORM pg_temp.nc_parity_assert(fac, 25, 75, 'Timbrada -> Aplicada counts once');
  UPDATE public.factura_notas_credito SET estado = 'Cancelada' WHERE id = nc;
  PERFORM pg_temp.nc_parity_assert(fac, 0, 100, 'Aplicada -> Cancelada releases credit');

  fac := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'ACTIVE-TO-DELETED');
  nc := pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'ACTIVE-DELETE', 25, 'MXN', 1, 'Timbrada');
  PERFORM pg_temp.nc_parity_assert(fac, 25, 75, 'active credit before soft delete');
  UPDATE public.factura_notas_credito SET deleted_at = now() WHERE id = nc;
  PERFORM pg_temp.nc_parity_assert(fac, 0, 100, 'active credit -> soft delete releases credit');

  fac := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'USD-TO-MXN');
  nc := pg_temp.nc_parity_seed_credit(fx.org_a, fac, 'USD1-TC20', 1, 'USD', 20, 'Timbrada');
  PERFORM pg_temp.nc_parity_assert(fac, 20, 80, 'NC USD1 TC20 -> invoice MXN100');
  UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = nc;
  PERFORM pg_temp.nc_parity_assert(fac, 20, 80, 'foreign Timbrada -> Aplicada counts once');

  fac_usd := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'MXN-TO-USD', 'USD');
  PERFORM pg_temp.assert((SELECT tipo_cambio FROM public.facturas WHERE id = fac_usd) = 20,
    'NC parity fixture: invoice USD rate must come from local DOF20');
  nc := pg_temp.nc_parity_seed_credit(fx.org_a, fac_usd, 'MXN20', 20, 'MXN', 1, 'Aplicada');
  PERFORM pg_temp.nc_parity_assert(fac_usd, 1, 99, 'NC MXN20 -> invoice USD100 TC20');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac_usd, 'EUR2-TC22', 2, 'EUR', 22, 'Timbrada');
  PERFORM pg_temp.nc_parity_assert(fac_usd, 3.2, 96.8, 'cross FX EUR2 TC22 -> USD2.2 plus MXN20');

  fac_eur := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'USD-TO-EUR', 'EUR');
  PERFORM pg_temp.assert((SELECT tipo_cambio FROM public.facturas WHERE id = fac_eur) = 22,
    'NC parity fixture: invoice EUR rate must come from local DOF22');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac_eur, 'USD2-TC20', 2, 'USD', 20, 'Aplicada');
  PERFORM pg_temp.nc_parity_assert(fac_eur, 40::numeric / 22, 100 - 40::numeric / 22,
    'cross FX USD2 TC20 -> invoice EUR100 TC22');

  fac_usd := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'USD-SAME-CURRENCY', 'USD');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, fac_usd, 'USD25', 25, 'USD', 20, 'Timbrada');
  PERFORM pg_temp.nc_parity_assert(fac_usd, 25, 75, 'same foreign currency does not convert twice');
  PERFORM pg_temp.nc_parity_assert(gen_random_uuid(), 0, 0, 'missing invoice');

  -- Only the balance contract is terminal for these invoice states. Credit
  -- helper lifecycle/soft-delete semantics are deliberately not invented here.
  terminal := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'CANCELADA-INVOICE');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, terminal, 'TERMINAL-CREDIT', 25, 'MXN', 1, 'Timbrada');
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = terminal;
  PERFORM pg_temp.assert(public._saldo_factura_calc(terminal) IS NOT DISTINCT FROM 0::numeric
    AND public.saldo_factura(terminal) IS NOT DISTINCT FROM 0::numeric,
    'NC parity: Cancelada invoice retains terminal balance0');
  terminal := pg_temp.nc_parity_seed_invoice(fx.org_a, cli, 'SUSTITUIDA-INVOICE');
  PERFORM pg_temp.nc_parity_seed_credit(fx.org_a, terminal, 'SUBSTITUTED-CREDIT', 25, 'MXN', 1, 'Aplicada');
  UPDATE public.facturas SET estado = 'Sustituida' WHERE id = terminal;
  PERFORM pg_temp.assert(public._saldo_factura_calc(terminal) IS NOT DISTINCT FROM 0::numeric
    AND public.saldo_factura(terminal) IS NOT DISTINCT FROM 0::numeric,
    'NC parity: Sustituida invoice retains terminal balance0');
  terminal := gen_random_uuid();
  INSERT INTO public.facturas(id, organization_id, cliente_id, numero, fecha_emision,
    fecha_vencimiento, subtotal, iva, total, moneda, estado)
  VALUES (terminal, fx.org_a, cli, 'NC-PARITY-DELETED-' || terminal, hoy, hoy + 30,
    100, 0, 100, 'MXN', 'Borrador');
  UPDATE public.facturas SET deleted_at = now() WHERE id = terminal;
  PERFORM pg_temp.assert(public._saldo_factura_calc(terminal) IS NOT DISTINCT FROM 0::numeric
    AND public.saldo_factura(terminal) IS NOT DISTINCT FROM 0::numeric,
    'NC parity: soft-deleted draft invoice retains balance0');
END $tests$;

DO $delegation$
BEGIN
  PERFORM pg_temp.assert((SELECT
    p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql')
    AND encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex')
        = '74b6f31561ad298d62d27bfa784af6c8994ea68f980d592bb0c9c68b2adfdfba'
    FROM pg_proc p
    WHERE p.oid = 'public.nc_aplicadas_en_moneda_factura(uuid)'::regprocedure),
    'NC parity: public wrapper must delegate without its own financial formula');
END $delegation$;

DO $unchanged_catalog$
DECLARE
  f record;
BEGIN
  PERFORM pg_temp.assert(NOT EXISTS (
    SELECT 1 FROM pg_temp.nc_parity_function_before saved
    LEFT JOIN pg_proc p ON p.oid = saved.oid
    WHERE p.oid IS NULL
      OR p.proname IS DISTINCT FROM saved.proname
      OR p.proowner IS DISTINCT FROM saved.proowner
      OR p.proacl::text IS DISTINCT FROM saved.acl
      OR p.proconfig IS DISTINCT FROM saved.proconfig
      OR p.provolatile IS DISTINCT FROM saved.provolatile
      OR p.prosecdef IS DISTINCT FROM saved.prosecdef
      OR encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')
           IS DISTINCT FROM saved.definition_sha256
  ), 'NC parity: reads and fixtures must preserve each helper definition, owner, ACL and search_path');
  FOR f IN SELECT * FROM pg_temp.nc_parity_function_before ORDER BY proname LOOP
    RAISE NOTICE 'NC parity function %: owner=%, definer=%, volatility=%, search_path=%, ACL=%, definition_sha256=%',
      f.proname, pg_get_userbyid(f.proowner), f.prosecdef, f.provolatile,
      f.proconfig, f.acl, f.definition_sha256;
  END LOOP;
  RAISE NOTICE 'NC parity passed: lifecycle, no double count, deleted NC, currencies, terminal invoice balances, unchanged facts/catalog';
END $unchanged_catalog$;
ROLLBACK;
