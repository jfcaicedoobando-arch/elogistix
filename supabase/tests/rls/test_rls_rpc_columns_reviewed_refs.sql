-- Reviewed-reference regression: synthetic caller/tenant fixtures, rollback only.
-- Uses existing functions and ACLs; never calls or changes the demo seed.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $reviewed_refs$
DECLARE
  fx record;
  company_a uuid := gen_random_uuid(); company_b uuid := gen_random_uuid();
  client_a uuid := gen_random_uuid(); client_b uuid := gen_random_uuid();
  op_a uuid := gen_random_uuid(); op_b uuid := gen_random_uuid();
  stage_a uuid; stage_b uuid;
  board_a uuid := gen_random_uuid(); board_b uuid := gen_random_uuid();
  report_a uuid := gen_random_uuid(); report_b uuid := gen_random_uuid(); report_op uuid := gen_random_uuid();
  actual jsonb; expected jsonb; rejected boolean := false; seed_source text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('RPC_REVIEW');
  INSERT INTO public.crm_empresas(id, organization_id, nombre)
    VALUES(company_a, fx.org_a, 'Synthetic company A'), (company_b, fx.org_b, 'Synthetic company B');
  INSERT INTO public.clientes(id, organization_id, nombre, email)
    VALUES(client_a, fx.org_a, 'Synthetic client A', 'rpc-review-a@test.local'),
          (client_b, fx.org_b, 'Synthetic client B', 'rpc-review-b@test.local');
  SELECT id INTO STRICT stage_a FROM public.crm_etapas_pipeline WHERE organization_id=fx.org_a AND tipo='abierta' LIMIT 1;
  SELECT id INTO STRICT stage_b FROM public.crm_etapas_pipeline WHERE organization_id=fx.org_b AND tipo='abierta' LIMIT 1;
  INSERT INTO public.crm_oportunidades(id, organization_id, nombre, cliente_id, etapa_id, monto_estimado, moneda)
    VALUES(op_a, fx.org_a, 'Synthetic opportunity A', client_a, stage_a, 100, 'USD'),
          (op_b, fx.org_b, 'Synthetic opportunity B', client_b, stage_b, 200, 'USD');
  INSERT INTO public.crm_tableros(id, organization_id, nombre)
    VALUES(board_a, fx.org_a, 'Synthetic board A'), (board_b, fx.org_b, 'Synthetic board B');
  INSERT INTO public.crm_reportes(id, organization_id, tablero_id, nombre, objeto, agrupacion)
    VALUES(report_a, fx.org_a, board_a, 'Company score A', 'empresa', 'puntaje'),
          (report_b, fx.org_b, board_b, 'Company score B', 'empresa', 'puntaje'),
          (report_op, fx.org_a, board_a, 'Opportunity score A', 'oportunidad', 'puntaje');

  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert(current_user='authenticated' AND public.org_scope()=fx.org_a, 'real invoker and tenant scope');
  PERFORM pg_temp.assert((SELECT e.letra_empresa_crm IS NOT DISTINCT FROM public.letra_empresa_crm(e)
    FROM public.crm_empresas e WHERE e.id=company_a), 'company computed-field notation equals function call');
  PERFORM pg_temp.assert((SELECT o.letra_oportunidad_crm IS NOT DISTINCT FROM public.letra_oportunidad_crm(o)
    FROM public.crm_oportunidades o WHERE o.id=op_a), 'opportunity computed-field notation equals function call');
  SELECT jsonb_agg(to_jsonb(x) ORDER BY etiqueta) INTO actual FROM public.crm_reporte_datos(report_a) x;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY etiqueta) INTO expected FROM (
    SELECT coalesce(public.letra_empresa_crm(e), 'Sin dato') AS etiqueta, count(*)::numeric AS valor
    FROM public.crm_empresas e WHERE e.organization_id=fx.org_a AND e.deleted_at IS NULL GROUP BY 1
  ) x;
  PERFORM pg_temp.assert(actual=expected, 'company score report uses existing calculation and current tenant');
  SELECT jsonb_agg(to_jsonb(x) ORDER BY etiqueta) INTO actual FROM public.crm_reporte_datos(report_op) x;
  SELECT jsonb_agg(to_jsonb(x) ORDER BY etiqueta) INTO expected FROM (
    SELECT coalesce(public.letra_oportunidad_crm(o), 'Sin dato') AS etiqueta, count(*)::numeric AS valor
    FROM public.crm_oportunidades o WHERE o.organization_id=fx.org_a AND o.deleted_at IS NULL GROUP BY 1
  ) x;
  PERFORM pg_temp.assert(actual=expected, 'opportunity score report uses existing calculation and current tenant');
  BEGIN
    PERFORM * FROM public.crm_reporte_datos(report_b);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'LC_REPORTE_NO_ENCONTRADO' THEN RAISE; END IF;
    rejected := true;
  END;
  PERFORM pg_temp.assert(rejected, 'foreign report remains unavailable');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.crm_empresas WHERE id=company_b), 'foreign company remains hidden');
  PERFORM pg_temp.assert(NOT EXISTS(SELECT 1 FROM public.crm_oportunidades WHERE id=op_b), 'foreign opportunity remains hidden');
  PERFORM pg_temp.as_postgres();
  -- Plan the exact valid column/CTE references without changing any business data.
  PERFORM c.tarifa_id FROM public.cotizaciones c LIMIT 0;
  PERFORM * FROM public._venta_facturada_por_embarque(fx.org_a);
  SELECT prosrc INTO STRICT seed_source FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
  PERFORM pg_temp.assert(position('C.V.' IN seed_source)>0, 'commercial-name literal exists');
  PERFORM pg_temp.assert(regexp_replace(seed_source, $literal$'(?:''|[^'])*'$literal$, '', 'g') !~* E'\\mc\\.v\\M',
    'seed c.v token exists only inside quoted literals; seed is never executed');
  RAISE NOTICE 'Reviewed RPC references: calculation, tenant isolation and no seed execution OK';
END
$reviewed_refs$;
ROLLBACK;
