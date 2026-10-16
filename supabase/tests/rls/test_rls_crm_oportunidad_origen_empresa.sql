-- Sólo fixtures sintéticos en la base efímera de rls-tests; todo termina en ROLLBACK.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $$
DECLARE
  org_a uuid := gen_random_uuid(); org_b uuid := gen_random_uuid();
  usuario uuid := gen_random_uuid();
  cliente uuid := gen_random_uuid(); otro_cliente uuid := gen_random_uuid();
  etapa uuid := gen_random_uuid();
  empresa_cliente uuid; empresa_manual uuid := gen_random_uuid();
  lead_empresa uuid := gen_random_uuid(); lead_manual uuid := gen_random_uuid();
  lead_nuevo uuid := gen_random_uuid(); lead_ajeno uuid := gen_random_uuid();
  datos jsonb; incorrecto jsonb; resultado jsonb; historico jsonb;
  antes integer; vinculos_antes integer; bloqueada boolean;
  funcion regprocedure := 'public.crm_crear_oportunidad_con_empresa(uuid,jsonb)'::regprocedure;
BEGIN
  PERFORM pg_temp.assert((SELECT NOT prosecdef FROM pg_proc WHERE oid = funcion), 'SECURITY INVOKER intacto');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon', funcion, 'EXECUTE'), 'anon no ejecuta');
  PERFORM pg_temp.assert(has_function_privilege('authenticated', funcion, 'EXECUTE')
    AND has_function_privilege('service_role', funcion, 'EXECUTE'), 'Grants originales intactos');
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'Origen A'), (org_b, 'Origen B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_a, usuario, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (usuario, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.clientes(id, nombre, email, organization_id) VALUES
    (cliente, 'Cliente asociado', 'origen-a@test.local', org_a),
    (otro_cliente, 'Otro cliente', 'origen-b@test.local', org_a);
  -- Usar la empresa creada por el trigger real de alta a clientes.
  SELECT id INTO STRICT empresa_cliente FROM public.crm_empresas WHERE cliente_id = cliente AND deleted_at IS NULL;
  INSERT INTO public.crm_etapas_pipeline(id, organization_id, nombre, orden, tipo)
    VALUES (etapa, org_a, 'Origen test', 99, 'abierta');
  INSERT INTO public.crm_leads(id, organization_id, empresa, estado) VALUES
    (lead_empresa, org_a, 'Lead de empresa', 'Prospecto'),
    (lead_manual, org_a, 'Selección manual calificada', 'Prospecto'),
    (lead_nuevo, org_a, 'No calificado', 'Nuevo'),
    (lead_ajeno, org_b, 'Lead ajeno', 'Prospecto');
  INSERT INTO public.crm_empresas(id, organization_id, nombre, lead_origen_id)
    VALUES (empresa_manual, org_a, 'Empresa sin cliente', lead_empresa);
  -- Registro previo con origen manual distinto al lead de la empresa: no se reescribe.
  INSERT INTO public.crm_oportunidades(organization_id, nombre, lead_id, etapa_id)
    VALUES (org_a, 'Histórica', lead_manual, etapa);
  SELECT to_jsonb(o) INTO historico FROM public.crm_oportunidades o WHERE organization_id = org_a AND nombre = 'Histórica';
  datos := jsonb_build_object('nombre', 'Nueva origen', 'etapa_id', etapa, 'cliente_id', cliente);
  PERFORM pg_temp.as_user(usuario);
  SELECT count(*) INTO antes FROM public.crm_oportunidades WHERE organization_id = org_a;
  SELECT count(*) INTO vinculos_antes FROM public.crm_oportunidad_empresa WHERE organization_id = org_a;
  FOREACH incorrecto IN ARRAY ARRAY[
    datos || jsonb_build_object('cliente_id', otro_cliente),
    datos || jsonb_build_object('cliente_id', NULL, 'lead_id', lead_manual),
    datos || jsonb_build_object('lead_id', lead_manual),
    datos || jsonb_build_object('cliente_id', NULL)
  ] LOOP
    bloqueada := false;
    BEGIN
      PERFORM public.crm_crear_oportunidad_con_empresa(empresa_cliente, incorrecto);
    EXCEPTION WHEN invalid_parameter_value THEN bloqueada := true;
    END;
    PERFORM pg_temp.assert(bloqueada, 'Empresa cliente rechaza otro cliente o cualquier lead');
    PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidades WHERE organization_id = org_a) = antes,
      'Payload incorrecto deja cero oportunidades');
    PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidad_empresa WHERE organization_id = org_a) = vinculos_antes,
      'Payload incorrecto deja cero vínculos');
  END LOOP;
  resultado := public.crm_crear_oportunidad_con_empresa(empresa_cliente, datos);
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.crm_oportunidades
    WHERE id = (resultado->>'id')::uuid AND cliente_id = cliente AND lead_id IS NULL), 'Cliente correcto sin lead');
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.crm_oportunidad_empresa
    WHERE oportunidad_id = (resultado->>'id')::uuid AND empresa_id = empresa_cliente), 'Vínculo atómico correcto');
  resultado := public.crm_crear_oportunidad_con_empresa(empresa_manual,
    datos || jsonb_build_object('cliente_id', NULL, 'lead_id', lead_manual));
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.crm_oportunidades
    WHERE id = (resultado->>'id')::uuid AND lead_id = lead_manual AND cliente_id IS NULL),
    'Sin cliente acepta manual calificado distinto de lead_origen_id');
  resultado := public.crm_crear_oportunidad_con_empresa(empresa_manual, datos || jsonb_build_object('cliente_id', otro_cliente));
  PERFORM pg_temp.assert(EXISTS (SELECT 1 FROM public.crm_oportunidades
    WHERE id = (resultado->>'id')::uuid AND cliente_id = otro_cliente), 'Sin cliente acepta cliente manual de la misma org');
  FOREACH incorrecto IN ARRAY ARRAY[
    datos || jsonb_build_object('cliente_id', NULL, 'lead_id', lead_nuevo),
    datos || jsonb_build_object('cliente_id', NULL, 'lead_id', lead_ajeno)
  ] LOOP
    bloqueada := false;
    BEGIN
      PERFORM public.crm_crear_oportunidad_con_empresa(empresa_manual, incorrecto);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO', 'LC_CRM_LEAD_AJENO') THEN RAISE; END IF;
      bloqueada := true;
    END;
    PERFORM pg_temp.assert(bloqueada, 'Manual conserva guards de calificación y misma organización');
  END LOOP;
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidades WHERE organization_id = org_a) = antes + 3,
    'Sólo las tres altas válidas persistieron');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidad_empresa WHERE organization_id = org_a) = vinculos_antes + 3,
    'Sólo las tres altas válidas tienen vínculo');
  PERFORM pg_temp.assert((SELECT to_jsonb(o) FROM public.crm_oportunidades o WHERE id = (historico->>'id')::uuid) = historico,
    'Histórico intacto');
  PERFORM pg_temp.as_postgres();
END;
$$;
ROLLBACK;
