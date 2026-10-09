-- Real replay schema, real organization membership/authorization and triggers.
-- Only test fixtures/temp helpers are created; never replace auth or public helpers.
-- Execute only in CI's disposable PostgreSQL 17.9 database; all data rolls back.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE TEMP TABLE pricing_guard_fixture (
  org_a uuid, org_b uuid, requester uuid, outsider uuid, pricing_user uuid,
  user_b uuid, request_id uuid, foreign_request_id uuid, created_by_request_id uuid,
  tariff_b uuid, suffix text
);
CREATE TEMP TABLE pricing_guard_tariffs (key text PRIMARY KEY, id uuid, type_id uuid);
CREATE TEMP TABLE pricing_guard_results (caso text PRIMARY KEY);

DO $fixture$
DECLARE
  o_a uuid := gen_random_uuid(); o_b uuid := gen_random_uuid();
  requester uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  pricing_user uuid := gen_random_uuid(); user_b uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid(); cli_b uuid := gen_random_uuid();
  stage_a uuid := gen_random_uuid(); stage_b uuid := gen_random_uuid();
  opp_a uuid := gen_random_uuid(); opp_b uuid := gen_random_uuid();
  req_a uuid := gen_random_uuid(); req_b uuid := gen_random_uuid();
  req_creator uuid := gen_random_uuid();
  provider_a uuid := gen_random_uuid(); provider_b uuid := gen_random_uuid();
  agent_a uuid := gen_random_uuid(); agent_b uuid := gen_random_uuid();
  port_a uuid := gen_random_uuid(); port_b uuid := gen_random_uuid();
  route_a uuid := gen_random_uuid(); route_b uuid := gen_random_uuid();
  carrier uuid := gen_random_uuid(); foreign_tariff uuid := gen_random_uuid();
  suffix text := translate(replace(gen_random_uuid()::text,'-',''),'0123456789','ghijklmnop');
  t record;
BEGIN
  INSERT INTO public.organizations(id,nombre) VALUES (o_a,'RPC container fixture A'),(o_b,'RPC container fixture B');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
    (o_a,requester,'vendedor'),(o_a,outsider,'vendedor'),
    (o_a,pricing_user,'ejecutivo_pricing'),(o_b,user_b,'vendedor');
  INSERT INTO public.user_roles(user_id,role) VALUES
    (requester,'vendedor'),(outsider,'vendedor'),(pricing_user,'ejecutivo_pricing'),(user_b,'vendedor')
    ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role;
  INSERT INTO public.clientes(id,nombre,rfc,email,organization_id) VALUES
    (cli_a,'RPC container customer A','XAXX010101000','a@rpc-container.test',o_a),
    (cli_b,'RPC container customer B','XAXX010101000','b@rpc-container.test',o_b);
  INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,orden,probabilidad_default,color,tipo) VALUES
    (stage_a,o_a,'RPC container fixture',991,10,'#2563EB','abierta'),
    (stage_b,o_b,'RPC container fixture',991,10,'#2563EB','abierta');
  INSERT INTO public.crm_oportunidades(id,organization_id,nombre,cliente_id,etapa_id,vendedor_id) VALUES
    (opp_a,o_a,'RPC container opportunity A',cli_a,stage_a,requester),
    (opp_b,o_b,'RPC container opportunity B',cli_b,stage_b,user_b);
  INSERT INTO public.proveedores(id,nombre,organization_id,categoria,tipo) VALUES
    (provider_a,'RPC container provider A',o_a,'Logistico','Agente de Carga'),
    (provider_b,'RPC container provider B',o_b,'Logistico','Agente de Carga');
  INSERT INTO public.costeo_agentes(id,organization_id,proveedor_id,nombre) VALUES
    (agent_a,o_a,provider_a,'RPC container agent A'),(agent_b,o_b,provider_b,'RPC container agent B');
  INSERT INTO public.puertos(id,code,name,country) VALUES
    (port_a,'RPCA-'||suffix,'RPC container origin','CN'),
    (port_b,'RPCB-'||suffix,'RPC container destination','MX');
  INSERT INTO public.navieras(id,code,name) VALUES (carrier,'RPC-'||suffix,'RPC container carrier');
  INSERT INTO public.costeo_rutas(id,organization_id,puerto_origen_id,puerto_destino_id,activa) VALUES
    (route_a,o_a,port_a,port_b,true),(route_b,o_b,port_a,port_b,true);
  FOR t IN SELECT * FROM (VALUES
    ('20GP','20'' Dry (Standard)'),('40HC','40'' High Cube'),
    ('40GP','40'' Dry (Standard)'),('40RF','40'' Reefer'),
    ('CUSTOM','Especial X'),('40HQ','40'' High Cube'),('20ST','20 Estándar'),
    ('???','!!!')
  ) AS types(code,name) LOOP
    INSERT INTO pricing_guard_tariffs VALUES (t.code,gen_random_uuid(),gen_random_uuid());
    INSERT INTO public.tipos_contenedor(id,code,name)
      SELECT type_id,CASE WHEN t.code='???' THEN '?!??!?!!?!' ELSE t.code||' '||suffix END,t.name
      FROM pricing_guard_tariffs WHERE key=t.code;
    INSERT INTO public.costeo_tarifas(id,organization_id,agente_id,naviera_id,ruta_id,
      tipo_contenedor_id,moneda,flete_base,vigente_desde,vigente_hasta,estado)
      SELECT id,o_a,agent_a,carrier,route_a,type_id,'USD',100,current_date-30,current_date+30,'vigente'
      FROM pricing_guard_tariffs WHERE key=t.code;
  END LOOP;
  INSERT INTO public.costeo_tarifas(id,organization_id,agente_id,naviera_id,ruta_id,
    tipo_contenedor_id,moneda,flete_base,vigente_desde,vigente_hasta,estado)
    SELECT foreign_tariff,o_b,agent_b,carrier,route_b,type_id,'USD',100,current_date-30,current_date+30,'vigente'
    FROM pricing_guard_tariffs WHERE key='40HC';
  -- Keep the real INSERT trigger; it derives created_by and validates membership/origin.
  PERFORM set_config('request.jwt.claims',json_build_object('sub',requester,'role','authenticated')::text,true);
  INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,folio,solicitante_id,tipo_carga)
    VALUES (req_a,o_a,opp_a,'trigger-generated',requester,'40HC'),
      (req_creator,o_a,opp_a,'trigger-generated',outsider,'40HC');
  PERFORM set_config('request.jwt.claims',json_build_object('sub',user_b,'role','authenticated')::text,true);
  INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,folio,solicitante_id,tipo_carga)
    VALUES (req_b,o_b,opp_b,'trigger-generated',user_b,'40HC');
  PERFORM pg_temp.as_postgres();
  INSERT INTO pricing_guard_fixture VALUES
    (o_a,o_b,requester,outsider,pricing_user,user_b,req_a,req_b,req_creator,foreign_tariff,suffix);
END
$fixture$;

CREATE FUNCTION pg_temp.expect_pricing_guard(
  p_caso text, p_tipo text, p_legacy text, p_tarifa_code text,
  p_error text DEFAULT NULL, p_estado text DEFAULT 'borrador',
  p_selected_code text DEFAULT NULL, p_actor text DEFAULT 'requester',
  p_request text DEFAULT 'own', p_deleted boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  f record; v_tarifa uuid; v_selected uuid; v_request uuid; v_actor uuid;
  v_resultado jsonb; v_error text; v_sqlstate text; v_before jsonb; v_after jsonb;
BEGIN
  PERFORM pg_temp.as_postgres();
  SELECT * INTO STRICT f FROM pricing_guard_fixture;
  SELECT id INTO v_tarifa FROM pricing_guard_tariffs WHERE key=p_tarifa_code;
  IF p_tarifa_code='foreign' THEN v_tarifa:=f.tariff_b; END IF;
  IF p_tarifa_code='missing' THEN v_tarifa:=gen_random_uuid(); END IF;
  SELECT id INTO v_selected FROM pricing_guard_tariffs WHERE key=p_selected_code;
  IF v_tarifa IS NULL THEN RAISE EXCEPTION 'Fixture tariff missing: %',p_tarifa_code; END IF;
  v_request := CASE p_request WHEN 'foreign' THEN f.foreign_request_id
    WHEN 'creator' THEN f.created_by_request_id WHEN 'missing' THEN gen_random_uuid() ELSE f.request_id END;
  v_actor := CASE p_actor WHEN 'outsider' THEN f.outsider WHEN 'pricing' THEN f.pricing_user
    WHEN 'foreign' THEN f.user_b WHEN 'no_uid' THEN NULL ELSE f.requester END;
  IF p_tipo='#CODE#' THEN
    SELECT tc.code INTO p_tipo FROM public.tipos_contenedor tc
      JOIN pricing_guard_tariffs m ON m.type_id=tc.id WHERE m.key=p_tarifa_code;
  END IF;
  -- Fixture-only state transition through the real trigger's existing internal flag.
  -- It is cleared before invocation; the caller cannot inherit test bypass state.
  PERFORM set_config('lc.pricing_rpc','1',true);
  UPDATE public.crm_solicitudes_pricing SET tipo_carga=p_tipo,container_size=p_legacy,
    estado=p_estado,tarifa_tarifario_id=v_selected,
    enviada_at=CASE WHEN p_estado IN ('enviada','respondida') THEN timestamptz '2001-01-01 00:00:00+00' ELSE NULL END,
    respondida_at=CASE WHEN p_estado='respondida' THEN timestamptz '2001-01-02 00:00:00+00' ELSE NULL END,
    deleted_at=CASE WHEN p_deleted THEN now() ELSE NULL END WHERE id=v_request;
  PERFORM set_config('lc.pricing_rpc','',true);
  SELECT to_jsonb(s) INTO v_before FROM public.crm_solicitudes_pricing s WHERE id=v_request;
  IF p_request<>'missing' AND v_before IS NULL THEN RAISE EXCEPTION 'Missing real request fixture'; END IF;
  PERFORM pg_temp.as_user(v_actor);
  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Fixture did not assume real authenticated role';
  END IF;
  BEGIN
    v_resultado := public.crm_aplicar_tarifa_tarifario(v_request,v_tarifa);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT,v_sqlstate=RETURNED_SQLSTATE;
  END;
  PERFORM pg_temp.as_postgres();
  IF v_error IS DISTINCT FROM p_error OR (p_error IS NOT NULL AND v_sqlstate IS DISTINCT FROM
    CASE WHEN p_error='LC_PRICING_SIN_PERMISO' THEN '42501' ELSE 'P0001' END) THEN
    RAISE EXCEPTION 'Case %: expected %, received % / %',p_caso,p_error,v_error,v_sqlstate;
  END IF;
  SELECT to_jsonb(s) INTO v_after FROM public.crm_solicitudes_pricing s WHERE id=v_request;
  IF p_error IS NOT NULL THEN
    IF v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION 'Case %: rejected call mutated the request',p_caso;
    END IF;
  ELSIF v_after->>'estado' IS DISTINCT FROM 'respondida'
      OR v_after->>'tarifa_tarifario_id' IS DISTINCT FROM v_tarifa::text
      OR v_resultado->>'id' IS DISTINCT FROM v_request::text THEN
    RAISE EXCEPTION 'Case %: selection was not persisted correctly',p_caso;
  ELSIF p_estado='respondida' AND v_selected=v_tarifa THEN
    IF v_resultado->>'ya_respondida' IS DISTINCT FROM 'true' OR v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION 'Case %: compatible idempotent call rewrote history',p_caso;
    END IF;
  ELSIF v_resultado->>'ya_respondida' IS DISTINCT FROM 'false'
      OR v_after->>'enviada_at' IS NULL OR v_after->>'respondida_at' IS NULL THEN
    RAISE EXCEPTION 'Case %: new selection missed response timestamps',p_caso;
  END IF;
  IF p_error IS NULL AND v_before->>'enviada_at' IS NOT NULL
      AND v_after->>'enviada_at' IS DISTINCT FROM v_before->>'enviada_at' THEN
    RAISE EXCEPTION 'Case %: existing sent timestamp was overwritten',p_caso;
  END IF;
  IF coalesce(current_setting('lc.pricing_rpc',true),'') <> '' THEN
    RAISE EXCEPTION 'Case %: internal pricing flag leaked to caller',p_caso;
  END IF;
  INSERT INTO pricing_guard_results VALUES (p_caso);
  RETURN v_resultado;
END $$;

SELECT pg_temp.expect_pricing_guard('primary 40HC matches', '40HC', NULL, '40HC');
SELECT pg_temp.expect_pricing_guard('primary rejects 20GP', '40HC', NULL, '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('HC rejects GP at same size', '40HC', NULL, '40GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('HC rejects reefer at same size', '40HC', NULL, '40RF', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('form catalog name matches', '40'' High Cube', NULL, '40HC');
SELECT pg_temp.expect_pricing_guard('HQ alias matches HC', '40HQ', NULL, '40HC');
SELECT pg_temp.expect_pricing_guard('HC matches catalog HQ alias', '40HC', NULL, '40HQ');
SELECT pg_temp.expect_pricing_guard('ST alias matches GP', '20ST', NULL, '20GP');
SELECT pg_temp.expect_pricing_guard('accented catalog name matches', '20 Estándar', NULL, '20GP');
SELECT pg_temp.expect_pricing_guard('GP matches catalog ST alias', '20GP', NULL, '20ST');
SELECT pg_temp.expect_pricing_guard('primary overrides conflicting legacy', '40HC', '20GP', '40HC');
SELECT pg_temp.expect_pricing_guard('legacy conflict cannot override primary', '40HC', '20GP', '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('null primary uses legacy', NULL, '40HC', '40HC');
SELECT pg_temp.expect_pricing_guard('blank primary uses legacy', '   ', '40HC', '40HC');
SELECT pg_temp.expect_pricing_guard('tab newline primary uses legacy', E'\t\n', '40HC', '40HC');
SELECT pg_temp.expect_pricing_guard('tab newline both fields missing', E'\t\n', E'\n\t', '40HC', 'LC_PRICING_CONTENEDOR_REQUERIDO');
SELECT pg_temp.expect_pricing_guard('legacy rejects wrong size', NULL, '40HC', '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('both fields missing', NULL, NULL, '20GP', 'LC_PRICING_CONTENEDOR_REQUERIDO');
SELECT pg_temp.expect_pricing_guard('both fields blank', '  ', '  ', '40HC', 'LC_PRICING_CONTENEDOR_REQUERIDO');
SELECT pg_temp.expect_pricing_guard('unknown does not match', '40XYZ', NULL, '40HC', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('raw code cannot override catalog name', 'CUSTOM', NULL, 'CUSTOM', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('raw catalog name exact', 'Especial X', NULL, 'CUSTOM');
SELECT pg_temp.expect_pricing_guard('raw mismatch rejected', 'Especial Y', NULL, 'CUSTOM', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('sent request still selects', '40HC', NULL, '40HC', NULL, 'enviada');
SELECT pg_temp.expect_pricing_guard('cancelled state still rejects', '40HC', NULL, '40HC', 'LC_PRICING_ESTADO_INVALIDO', 'cancelada');
SELECT pg_temp.expect_pricing_guard('compatible idempotent selection', '40HC', NULL, '40HC', NULL, 'respondida', '40HC');
SELECT pg_temp.expect_pricing_guard('incompatible idempotent link rejects', '40HC', NULL, '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE', 'respondida', '20GP');

-- Fail closed when the catalog code and name independently specify different
-- semantic types; combined shared normalization alone would hide the conflict.
UPDATE public.tipos_contenedor SET name = '40'' High Cube' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
SELECT pg_temp.expect_pricing_guard('contradictory catalog size cannot match name', '40HC', NULL, '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('contradictory catalog size cannot match code', '20GP', NULL, '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '20'' Dry (Standard)' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
UPDATE public.tipos_contenedor SET name = '40'' High Cube' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40GP');
SELECT pg_temp.expect_pricing_guard('contradictory catalog category cannot match name', '40HC', NULL, '40GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('contradictory catalog category cannot match code', '40GP', NULL, '40GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '40'' Dry (Standard)' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40GP');
SELECT pg_temp.expect_pricing_guard('punctuation-only request cannot match', '!!!', NULL, 'CUSTOM', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
SELECT pg_temp.expect_pricing_guard('equal empty raw keys cannot match', '???', NULL, '???', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '   ' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='CUSTOM');
SELECT pg_temp.expect_pricing_guard('raw code fallback when catalog name blank', '#CODE#', NULL, 'CUSTOM');
UPDATE public.tipos_contenedor SET name = 'Especial X' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='CUSTOM');

-- partial fields: begin focused regressions and coherent complements.
-- Independently known size/category must agree even when another component
-- is absent. These cases can run alone after the fixture/helper bootstrap.
UPDATE public.tipos_contenedor SET name = '20''' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('partial fields reject name-only size conflict', '20HC', NULL, '40HC', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '40'' High Cube' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
UPDATE public.tipos_contenedor SET name = 'High Cube' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40GP');
SELECT pg_temp.expect_pricing_guard('partial fields reject name-only category conflict', '40HC', NULL, '40GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '40'' Dry (Standard)' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40GP');
UPDATE public.tipos_contenedor SET name = '40''' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
SELECT pg_temp.expect_pricing_guard('partial fields reject reversed size conflict', '40GP', NULL, '20GP', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '20'' Dry (Standard)' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
UPDATE public.tipos_contenedor SET name = 'Dry' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('partial fields reject reversed category conflict', '40HC', NULL, '40HC', 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE');
UPDATE public.tipos_contenedor SET name = '40''', code = 'HC '||(SELECT suffix FROM pricing_guard_fixture) WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('partial fields allow size-category complement', '40HC', NULL, '40HC');
UPDATE public.tipos_contenedor SET name = 'High Cube', code = '40HC '||(SELECT suffix FROM pricing_guard_fixture) WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('partial fields allow coherent category-only name', '40HC', NULL, '40HC');
UPDATE public.tipos_contenedor SET name = '40'' High Cube' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='40HC');
UPDATE public.tipos_contenedor SET name = '20''' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
SELECT pg_temp.expect_pricing_guard('partial fields allow coherent size-only name', '20GP', NULL, '20GP');
UPDATE public.tipos_contenedor SET name = '20'' Dry (Standard)' WHERE id=(SELECT type_id FROM pricing_guard_tariffs WHERE key='20GP');
-- partial fields: end focused regressions and coherent complements.


-- Real schema has NOT NULL type and date constraints. Do not weaken them to port
-- mocked cases: a missing tariff exercises the fail-closed catalog join instead.
SELECT pg_temp.expect_pricing_guard('missing tariff rejects','40HC',NULL,'missing','LC_TARIFA_NO_VIGENTE');
UPDATE public.costeo_tarifas SET vigente_hasta=current_date-1
  WHERE id=(SELECT id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('expired tariff rejects new selection','40HC',NULL,'40HC','LC_TARIFA_NO_VIGENTE');
SELECT pg_temp.expect_pricing_guard('expired compatible existing link stays idempotent','40HC',NULL,'40HC',NULL,'respondida','40HC');
UPDATE public.costeo_tarifas SET vigente_hasta=current_date+30,estado='borrador'
  WHERE id=(SELECT id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('non-current tariff rejects','40HC',NULL,'40HC','LC_TARIFA_NO_VIGENTE');
UPDATE public.costeo_tarifas SET estado='vigente'
  WHERE id=(SELECT id FROM pricing_guard_tariffs WHERE key='40HC');
SELECT pg_temp.expect_pricing_guard('same-org outsider rejects','40HC',NULL,'40HC','LC_PRICING_SIN_PERMISO','borrador',NULL,'outsider');
SELECT pg_temp.expect_pricing_guard('pricing member selects','40HC',NULL,'40HC',NULL,'borrador',NULL,'pricing');
SELECT pg_temp.expect_pricing_guard('created_by path selects','40HC',NULL,'40HC',NULL,'borrador',NULL,'requester','creator');
SELECT pg_temp.expect_pricing_guard('requester other than creator selects','40HC',NULL,'40HC',NULL,'borrador',NULL,'outsider','creator');
SELECT pg_temp.expect_pricing_guard('cross-org request rejects','40HC',NULL,'40HC','LC_PRICING_NO_ENCONTRADA','borrador',NULL,'requester','foreign');
SELECT pg_temp.expect_pricing_guard('cross-org user rejects','40HC',NULL,'40HC','LC_PRICING_NO_ENCONTRADA','borrador',NULL,'foreign');
SELECT pg_temp.expect_pricing_guard('cross-org tariff rejects','40HC',NULL,'foreign','LC_TARIFA_NO_VIGENTE');
SELECT pg_temp.expect_pricing_guard('missing auth uid rejects','40HC',NULL,'40HC','LC_PRICING_NO_ENCONTRADA','borrador',NULL,'no_uid');
SELECT pg_temp.expect_pricing_guard('missing request rejects','40HC',NULL,'40HC','LC_PRICING_NO_ENCONTRADA','borrador',NULL,'requester','missing');
SELECT pg_temp.expect_pricing_guard('soft-deleted request rejects','40HC',NULL,'40HC','LC_PRICING_NO_ENCONTRADA','borrador',NULL,'requester','own',true);
SELECT pg_temp.expect_pricing_guard('responded request cannot select another compatible tariff','40HC',NULL,'40HQ','LC_PRICING_ESTADO_INVALIDO','respondida','40HC');
SELECT pg_temp.expect_pricing_guard('incompatible idempotent link rejects pricing user','40HC',NULL,'20GP','LC_TARIFA_CONTENEDOR_INCOMPATIBLE','respondida','20GP','pricing');

DO $assert_count$
BEGIN
  IF (SELECT count(*) FROM pricing_guard_results) <> 57 THEN
    RAISE EXCEPTION 'Unexpected number of real-schema container guard cases';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.costeo_tarifas'::regclass
    AND attname='tipo_contenedor_id' AND attnotnull) THEN
    RAISE EXCEPTION 'The real tariff type NOT NULL invariant was weakened';
  END IF;
  RAISE NOTICE 'pricing container RPC: 57 real-schema authenticated cases passed';
END
$assert_count$;
SELECT caso FROM pricing_guard_results ORDER BY caso;
ROLLBACK;
