-- ============================================================================
-- Suite RLS — Mutaciones cruzadas (UPDATE/DELETE) entre tenants (H5b)
-- ============================================================================
-- Los tests previos verifican principalmente SELECT + INSERT. Aquí probamos
-- que un admin de org_b NO puede UPDATE ni DELETE filas de org_a en tablas
-- de dinero/documentos. Un UPDATE bloqueado por RLS en Postgres NO lanza
-- error: simplemente afecta 0 filas. Por eso comprobamos ROW_COUNT.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.assert_no_rows_affected(_sql text, _msg text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RETURN;  -- RLS también puede lanzar → seguro
  END;
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v <> 0 THEN
    RAISE EXCEPTION 'RLS CROSS-MUT FAIL: % — % filas afectadas cruzando tenants', _msg, v;
  END IF;
END;
$$;

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  visible int;
  total_actual numeric;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'X-MUT A'), (org_b, 'X-MUT B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli X-Mut A', 'XAXX010101000', 'a@x', org_a),
    (cli_b, 'Cli X-Mut B', 'XAXX010101001', 'b@x', org_b);
  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELXMU00001', cli_a, 'Cli X-Mut A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELXMU00002', cli_b, 'Cli X-Mut B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac_a, org_a, cli_a, 'Cli X-Mut A', emb_a, 'XM-A-001', CURRENT_DATE, CURRENT_DATE+15, 'MXN', 1000, 160, 1160, 'Emitida'),
    (fac_b, org_b, cli_b, 'Cli X-Mut B', emb_b, 'XM-B-001', CURRENT_DATE, CURRENT_DATE+15, 'MXN', 2000, 320, 2320, 'Emitida');

  -- user_b intenta modificar clientes de org_a
  PERFORM pg_temp.as_user(user_b);
  PERFORM pg_temp.assert_no_rows_affected(
    format('UPDATE public.clientes SET nombre = ''HIJACKED'' WHERE id = %L', cli_a),
    'user_b UPDATE clientes de org_a'
  );
  PERFORM pg_temp.assert_no_rows_affected(
    format('UPDATE public.embarques SET estado = ''Cancelado'' WHERE id = %L', emb_a),
    'user_b UPDATE embarques de org_a'
  );
  PERFORM pg_temp.assert_no_rows_affected(
    format('UPDATE public.facturas SET total = 0 WHERE id = %L', fac_a),
    'user_b UPDATE facturas de org_a'
  );
  PERFORM pg_temp.assert_no_rows_affected(
    format('DELETE FROM public.embarques WHERE id = %L', emb_a),
    'user_b DELETE embarques de org_a'
  );
  PERFORM pg_temp.assert_no_rows_affected(
    format('DELETE FROM public.facturas WHERE id = %L', fac_a),
    'user_b DELETE facturas de org_a'
  );

  PERFORM pg_temp.as_postgres();

  -- Verificamos integridad: los valores originales de org_a NO cambiaron
  SELECT total INTO total_actual FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(total_actual = 1160, format('factura de org_a fue modificada: total=%s', total_actual));
  SELECT count(*) INTO visible FROM public.embarques WHERE id = emb_a;
  PERFORM pg_temp.assert(visible = 1, 'embarque de org_a fue borrado desde otra org');

  RAISE NOTICE '✓ test_rls_cross_tenant_mutations: 5 mutaciones cruzadas bloqueadas OK';
END;
$$;

ROLLBACK;
