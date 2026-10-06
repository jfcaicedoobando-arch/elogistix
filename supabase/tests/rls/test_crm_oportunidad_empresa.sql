-- Prueba focalizada: ejecutar sólo en base efímera; no modifica datos reales.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  usuario uuid := gen_random_uuid();
  cliente uuid := gen_random_uuid();
  etapa uuid := gen_random_uuid();
  empresa uuid := gen_random_uuid();
  ajena uuid := gen_random_uuid();
  eliminada uuid := gen_random_uuid();
  datos jsonb;
  resultado jsonb;
  antes integer;
  bloqueada boolean;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'Empresa test A'), (org_b, 'Empresa test B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_a, usuario, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (usuario, 'admin_org');
  INSERT INTO public.clientes(id, nombre, organization_id) VALUES (cliente, 'Cliente test', org_a);
  INSERT INTO public.crm_etapas_pipeline(id, organization_id, nombre, orden, tipo)
    VALUES (etapa, org_a, 'Etapa empresa test', 99, 'abierta');
  INSERT INTO public.crm_empresas(id, organization_id, nombre, deleted_at) VALUES
    (empresa, org_a, 'Empresa válida', NULL), (ajena, org_b, 'Empresa ajena', NULL),
    (eliminada, org_a, 'Empresa eliminada', now());
  datos := jsonb_build_object('nombre', 'Oportunidad prueba', 'cliente_id', cliente, 'etapa_id', etapa);
  PERFORM pg_temp.as_user(usuario);
  SELECT count(*) INTO antes FROM public.crm_oportunidades;
  bloqueada := false;
  BEGIN
    PERFORM public.crm_crear_oportunidad_con_empresa(NULL, datos);
  EXCEPTION WHEN invalid_parameter_value THEN bloqueada := true;
  END;
  PERFORM pg_temp.assert(bloqueada, 'Sin empresa debe bloquear');
  bloqueada := false;
  BEGIN
    PERFORM public.crm_crear_oportunidad_con_empresa(ajena, datos);
  EXCEPTION WHEN insufficient_privilege THEN bloqueada := true;
  END;
  PERFORM pg_temp.assert(bloqueada, 'Empresa ajena debe bloquear');
  bloqueada := false;
  BEGIN
    PERFORM public.crm_crear_oportunidad_con_empresa(eliminada, datos);
  EXCEPTION WHEN insufficient_privilege THEN bloqueada := true;
  END;
  PERFORM pg_temp.assert(bloqueada, 'Empresa eliminada debe bloquear');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidades) = antes, 'Rechazos no dejan oportunidades');
  resultado := public.crm_crear_oportunidad_con_empresa(empresa, datos);
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM public.crm_oportunidad_empresa
    WHERE oportunidad_id = (resultado->>'id')::uuid AND empresa_id = empresa AND organization_id = org_a
  ), 'El alta debe guardar el vínculo');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidades) = antes + 1, 'Sólo una oportunidad creada');
  PERFORM pg_temp.as_postgres();
END;
$$;
ROLLBACK;