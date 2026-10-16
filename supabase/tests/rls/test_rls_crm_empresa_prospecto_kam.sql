-- Regresion del permiso adicional KAM de crm_empresa_pasar_a_prospecto.
-- Ejecutar exclusivamente en PostgreSQL efimero. Triggers y RLS permanecen
-- activos; los fixtures historicos inconsistentes se preparan como postgres.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- ctid detecta UPDATE redundante aunque now()/updated_at sean constantes en
-- toda la transaccion. Se comparan filas completas, conteos e historial, desde
-- postgres: RLS del actor no puede esconder una escritura en otro tenant.
CREATE OR REPLACE FUNCTION pg_temp.prospecto_snapshot() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'empresas', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.id), '[]'::jsonb)) FROM public.crm_empresas t),
    'leads', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.id), '[]'::jsonb)) FROM public.crm_leads t),
    'oportunidades', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.id), '[]'::jsonb)) FROM public.crm_oportunidades t),
    'vinculos', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.empresa_id, t.oportunidad_id), '[]'::jsonb)) FROM public.crm_oportunidad_empresa t),
    'historial', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.id), '[]'::jsonb)) FROM public.crm_historial_etapas t),
    'clientes', (SELECT jsonb_build_object('n', count(*), 'rows', coalesce(jsonb_agg(
      jsonb_build_object('fila', to_jsonb(t), 'ctid', t.ctid::text, 'xmin', t.xmin::text)
      ORDER BY t.id), '[]'::jsonb)) FROM public.clientes t)
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_actor(
  p_org uuid, p_membresia public.app_role, p_global public.app_role DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_uid uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.seed_auth_user(v_uid);
  -- INSERT del rol vigente admitido y UPDATE legal para legacy. No se
  -- deshabilita el trigger que sincroniza organization_members/user_roles.
  INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (p_org, v_uid, 'customer_service');
  UPDATE public.organization_members SET role = p_membresia
    WHERE organization_id = p_org AND user_id = v_uid;
  INSERT INTO public.user_roles(user_id, role) VALUES (v_uid, coalesce(p_global, p_membresia))
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_lead(
  p_org uuid, p_owner uuid, p_estado public.crm_lead_estado DEFAULT 'Prospecto',
  p_deleted timestamptz DEFAULT NULL, p_cliente uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.crm_leads(id, organization_id, empresa, vendedor_id,
    created_by, estado, deleted_at, cliente_convertido_id)
  VALUES (v_id, p_org, 'Lead KAM ' || v_id, p_owner, p_owner, p_estado, p_deleted, p_cliente);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_empresa(
  p_org uuid, p_owner uuid, p_lead uuid DEFAULT NULL,
  p_estado text DEFAULT 'Lead', p_deleted timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.crm_empresas(id, organization_id, nombre, created_by,
    lead_origen_id, estado_crm, deleted_at)
  VALUES (v_id, p_org, 'Empresa KAM ' || v_id, p_owner, p_lead, p_estado, p_deleted);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_oportunidad(
  p_org uuid, p_owner uuid, p_lead uuid, p_etapa uuid, p_empresa uuid,
  p_link_org uuid DEFAULT NULL, p_deleted timestamptz DEFAULT NULL,
  p_cliente uuid DEFAULT NULL, p_creada timestamptz DEFAULT now()
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.crm_oportunidades(id, organization_id, nombre, vendedor_id,
    created_by, lead_id, etapa_id, deleted_at, cliente_id, created_at)
  VALUES (v_id, p_org, 'Oportunidad KAM ' || v_id, p_owner, p_owner,
    p_lead, p_etapa, p_deleted, p_cliente, p_creada);
  INSERT INTO public.crm_oportunidad_empresa(organization_id, oportunidad_id, empresa_id)
    VALUES (coalesce(p_link_org, p_org), v_id, p_empresa);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_denegado(
  p_actor uuid, p_empresa uuid, p_state text, p_error text, p_caso text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_antes jsonb; v_state text; v_error text;
BEGIN
  PERFORM pg_temp.as_postgres();
  v_antes := pg_temp.prospecto_snapshot();
  PERFORM pg_temp.as_user(p_actor);
  BEGIN
    PERFORM public.crm_empresa_pasar_a_prospecto(p_empresa);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_error = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(v_state IS NOT DISTINCT FROM p_state AND v_error IS NOT DISTINCT FROM p_error,
    format('%s: esperado %s/%s; recibido %s/%s', p_caso, p_state, p_error, v_state, v_error));
  PERFORM pg_temp.assert(pg_temp.prospecto_snapshot() IS NOT DISTINCT FROM v_antes,
    p_caso || ': rechazo debe conservar filas, conteos, propietarios e historial en ambos tenants');
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_reintento(
  p_actor uuid, p_empresa uuid, p_oportunidad uuid, p_caso text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_antes jsonb; v_resultado jsonb; v_i integer;
BEGIN
  PERFORM pg_temp.as_postgres();
  v_antes := pg_temp.prospecto_snapshot();
  FOR v_i IN 1..2 LOOP
    PERFORM pg_temp.as_user(p_actor);
    v_resultado := public.crm_empresa_pasar_a_prospecto(p_empresa);
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert((v_resultado = jsonb_build_object('oportunidad_id', p_oportunidad, 'sin_cambios', true)) IS TRUE,
      format('%s: reintento %s devuelve la misma oportunidad y sin_cambios', p_caso, v_i));
    PERFORM pg_temp.assert(pg_temp.prospecto_snapshot() IS NOT DISTINCT FROM v_antes,
      format('%s: reintento %s no inserta, actualiza, duplica ni reasigna filas', p_caso, v_i));
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.prospecto_exito(
  p_actor uuid, p_empresa uuid, p_org uuid, p_lead uuid, p_op uuid, p_caso text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_antes jsonb; v_resultado jsonb; v_lead uuid; v_op uuid;
BEGIN
  PERFORM pg_temp.as_postgres();
  v_antes := pg_temp.prospecto_snapshot();
  PERFORM pg_temp.as_user(p_actor);
  PERFORM pg_temp.assert((auth.uid() = p_actor AND public.org_scope() = p_org) IS TRUE,
    p_caso || ': sesion authenticated y tenant activo explicitos');
  v_resultado := public.crm_empresa_pasar_a_prospecto(p_empresa);
  PERFORM pg_temp.as_postgres();
  v_op := (v_resultado->>'oportunidad_id')::uuid;
  SELECT lead_origen_id INTO STRICT v_lead FROM public.crm_empresas WHERE id = p_empresa;
  PERFORM pg_temp.assert((v_resultado->>'sin_cambios' = 'false' AND v_op IS NOT NULL) IS TRUE,
    p_caso || ': la primera transicion se confirma con una oportunidad');
  PERFORM pg_temp.assert((p_lead IS NULL OR v_lead = p_lead) IS TRUE, p_caso || ': conserva el lead existente');
  PERFORM pg_temp.assert((p_op IS NULL OR v_op = p_op) IS TRUE, p_caso || ': reutiliza la oportunidad existente');
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM public.crm_empresas e JOIN public.crm_leads l ON l.id = e.lead_origen_id
      JOIN public.crm_oportunidad_empresa oe ON oe.empresa_id = e.id
      JOIN public.crm_oportunidades o ON o.id = oe.oportunidad_id
    WHERE e.id = p_empresa AND e.organization_id = p_org AND e.estado_crm = 'Prospecto'
      AND e.deleted_at IS NULL AND e.cliente_id IS NULL AND l.id = v_lead
      AND l.organization_id = p_org AND l.vendedor_id = p_actor AND l.deleted_at IS NULL
      AND l.estado::text = 'Prospecto' AND o.id = v_op AND o.organization_id = p_org
      AND o.lead_id = v_lead AND o.vendedor_id = p_actor AND o.deleted_at IS NULL
      AND oe.organization_id = p_org), p_caso || ': empresa, lead, oportunidad y vinculo coherentes');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_leads) = (v_antes->'leads'->>'n')::bigint
      + CASE WHEN p_lead IS NULL THEN 1 ELSE 0 END, p_caso || ': conteo exacto de leads');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidades) = (v_antes->'oportunidades'->>'n')::bigint
      + CASE WHEN p_op IS NULL THEN 1 ELSE 0 END, p_caso || ': conteo exacto de oportunidades');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.crm_oportunidad_empresa) = (v_antes->'vinculos'->>'n')::bigint
      + CASE WHEN p_op IS NULL THEN 1 ELSE 0 END, p_caso || ': conteo exacto de vinculos');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.clientes) = (v_antes->'clientes'->>'n')::bigint,
    p_caso || ': no crea clientes');
  IF p_lead IS NULL THEN
    PERFORM pg_temp.assert((SELECT created_by = p_actor FROM public.crm_leads WHERE id = v_lead) IS TRUE,
      p_caso || ': lead nuevo atribuido al actor');
  END IF;
  IF p_op IS NULL THEN
    PERFORM pg_temp.assert((SELECT created_by = p_actor FROM public.crm_oportunidades WHERE id = v_op) IS TRUE,
      p_caso || ': oportunidad nueva atribuida al actor');
  END IF;
  PERFORM pg_temp.prospecto_reintento(p_actor, p_empresa, v_op, p_caso);
  RETURN v_op;
END;
$$;

DO $$
DECLARE
  fx record;
  v_kam uuid; v_otro uuid; v_usuario uuid; v_sin_org uuid := gen_random_uuid();
  v_sa uuid := gen_random_uuid(); v_etapa_a uuid := gen_random_uuid(); v_etapa_b uuid := gen_random_uuid();
  v_cliente uuid := gen_random_uuid(); v_empresa uuid; v_lead uuid; v_op uuid;
  v_otro_lead uuid; v_otra_op uuid; v_role public.app_role; v_caso text;
  v_state text; v_error text;
  v_matriz integer := 0;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('RLS PROSPECTO KAM');
  v_kam := pg_temp.prospecto_actor(fx.org_a, 'vendedor');
  v_otro := pg_temp.prospecto_actor(fx.org_a, 'vendedor');
  PERFORM pg_temp.seed_auth_user(v_sin_org);
  INSERT INTO public.user_roles(user_id, role) VALUES (v_sin_org, 'vendedor');
  INSERT INTO public.crm_etapas_pipeline(id, organization_id, nombre, orden, tipo)
    VALUES (v_etapa_a, fx.org_a, 'Prospecto', 10, 'abierta'), (v_etapa_b, fx.org_b, 'Prospecto', 10, 'abierta')
    ON CONFLICT (organization_id, nombre) DO NOTHING;
  -- handle_new_organization ya siembra Prospecto con los triggers reales.
  SELECT id INTO STRICT v_etapa_a FROM public.crm_etapas_pipeline
    WHERE organization_id = fx.org_a AND nombre = 'Prospecto';
  SELECT id INTO STRICT v_etapa_b FROM public.crm_etapas_pipeline
    WHERE organization_id = fx.org_b AND nombre = 'Prospecto';
  INSERT INTO public.clientes(id, organization_id, nombre, email)
    VALUES (v_cliente, fx.org_a, 'Cliente KAM', 'cliente-kam@test.local');

  -- El permiso adicional no debe alcanzar los otros consumidores del helper.
  PERFORM pg_temp.as_user(v_kam);
  BEGIN
    PERFORM public._assert_writer(fx.org_a);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_error = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(v_state IS NOT DISTINCT FROM '42501' AND v_error IS NOT DISTINCT FROM 'Permisos insuficientes',
    '_assert_writer conserva su rechazo previo de vendedor');

  -- Propio sin lead y propio con lead manual: se atribuyen exactamente las
  -- entidades nuevas al KAM; se conserva el vinculo y no se duplica al repetir.
  FOREACH v_caso IN ARRAY ARRAY['Lead', 'Sospechoso'] LOOP
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, NULL, v_caso);
    PERFORM pg_temp.prospecto_exito(v_kam, v_empresa, fx.org_a, NULL, NULL, 'KAM propio sin lead ' || v_caso);
  END LOOP;
  v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam, 'Contactado');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead);
  PERFORM pg_temp.prospecto_exito(v_kam, v_empresa, fx.org_a, v_lead, NULL, 'KAM con lead propio');

  v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead);
  v_op := pg_temp.prospecto_oportunidad(fx.org_a, v_kam, v_lead, v_etapa_a, v_empresa);
  PERFORM pg_temp.prospecto_exito(v_kam, v_empresa, fx.org_a, v_lead, v_op, 'KAM reutiliza oportunidad propia');

  -- Varias oportunidades propias coherentes son validas y se reutiliza la
  -- primera de forma determinista, sin fabricar una tercera al reintentar.
  v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead);
  v_op := pg_temp.prospecto_oportunidad(fx.org_a, v_kam, v_lead, v_etapa_a, v_empresa,
    NULL, NULL, NULL, now() - interval '1 minute');
  PERFORM pg_temp.prospecto_oportunidad(fx.org_a, v_kam, v_lead, v_etapa_a, v_empresa);
  PERFORM pg_temp.prospecto_exito(v_kam, v_empresa, fx.org_a, v_lead, v_op, 'KAM varias oportunidades propias');

  -- La autorizacion se repite antes del retorno idempotente, incluso cuando
  -- el mismo actor ya realizo la transicion y luego cambia la propiedad.
  UPDATE public.crm_empresas SET created_by = v_otro WHERE id = v_empresa;
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_NO_AUTORIZADO', 'reintento empresa reasignada');
  UPDATE public.crm_empresas SET created_by = v_kam WHERE id = v_empresa;
  UPDATE public.crm_leads SET vendedor_id = v_otro WHERE id = v_lead;
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'reintento lead reasignado');
  UPDATE public.crm_leads SET vendedor_id = v_kam WHERE id = v_lead;
  UPDATE public.crm_oportunidades SET vendedor_id = v_otro WHERE id = v_op;
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'reintento oportunidad reasignada');
  UPDATE public.crm_oportunidades SET vendedor_id = v_kam WHERE id = v_op;
  UPDATE public.crm_oportunidad_empresa SET organization_id = fx.org_b WHERE oportunidad_id = v_op;
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'reintento vinculo cross-org');

  -- La membresia efectiva prevalece sobre el espejo global obsoleto.
  v_usuario := pg_temp.prospecto_actor(fx.org_a, 'viewer', 'vendedor');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_usuario);
  PERFORM pg_temp.prospecto_denegado(v_usuario, v_empresa, '42501', 'Permisos insuficientes', 'global vendedor con membresia viewer');
  v_usuario := pg_temp.prospecto_actor(fx.org_a, 'vendedor', 'viewer');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_usuario);
  PERFORM pg_temp.prospecto_exito(v_usuario, v_empresa, fx.org_a, NULL, NULL, 'membresia vendedor con global viewer');
  DELETE FROM public.user_roles WHERE user_id = v_usuario;
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_usuario);
  PERFORM pg_temp.prospecto_exito(v_usuario, v_empresa, fx.org_a, NULL, NULL, 'membresia vendedor sin espejo global');

  -- Congelar la ruta legacy completa: admin, operacion y contabilidad
  -- conservan sus roles jerarquicos actuales y actuan sobre empresa ajena.
  FOREACH v_role IN ARRAY ARRAY['admin', 'admin_org', 'operador', 'gerente_operaciones',
    'coordinador_logistico', 'contador', 'auxiliar_contable']::public.app_role[] LOOP
    v_usuario := pg_temp.prospecto_actor(fx.org_a, v_role);
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_otro);
    PERFORM pg_temp.prospecto_exito(v_usuario, v_empresa, fx.org_a, NULL, NULL, 'writer previo ' || v_role::text);
    v_matriz := v_matriz + 1;
  END LOOP;
  FOREACH v_role IN ARRAY ARRAY['viewer', 'gerente_comercial', 'customer_service',
    'tesorero', 'ejecutivo_cobranza', 'ejecutivo_pricing', 'gerente_visor', 'cliente', 'agente_carga']::public.app_role[] LOOP
    v_usuario := pg_temp.prospecto_actor(fx.org_a, v_role);
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_usuario);
    PERFORM pg_temp.prospecto_denegado(v_usuario, v_empresa, '42501', 'Permisos insuficientes', 'sin expansion al rol ' || v_role::text);
    v_matriz := v_matriz + 1;
  END LOOP;
  PERFORM pg_temp.assert(v_matriz = 16, 'matriz completa de 16 roles no KAM ni plataforma');
  PERFORM pg_temp.seed_auth_user(v_sa);
  INSERT INTO public.user_roles(user_id, role) VALUES (v_sa, 'super_admin');
  PERFORM pg_temp.as_user(v_sa);
  PERFORM public.set_super_admin_org(fx.org_a);
  PERFORM pg_temp.as_postgres();
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_otro);
  PERFORM pg_temp.prospecto_exito(v_sa, v_empresa, fx.org_a, NULL, NULL, 'super admin tenant activo');

  -- Propiedad de empresa: NULL nunca atribuye un registro heredado al actor.
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_otro);
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_NO_AUTORIZADO', 'empresa ajena');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, NULL);
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_NO_AUTORIZADO', 'empresa created_by NULL');
  v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_otro, v_lead);
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_NO_AUTORIZADO', 'lead propio injertado en empresa ajena');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, NULL, 'Lead', now());
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, 'P0002', 'LC_CRM_EMPRESA_NO_ENCONTRADA', 'empresa borrada no se reactiva');
  v_empresa := pg_temp.prospecto_empresa(fx.org_b, v_kam);
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, 'P0002', 'LC_CRM_EMPRESA_NO_ENCONTRADA', 'empresa propia fuera de tenant activo');
  PERFORM pg_temp.prospecto_denegado(v_kam, gen_random_uuid(), 'P0002', 'LC_CRM_EMPRESA_NO_ENCONTRADA', 'empresa inexistente');
  PERFORM pg_temp.prospecto_denegado(v_kam, NULL, 'P0002', 'LC_CRM_EMPRESA_NO_ENCONTRADA', 'empresa id NULL');
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam);
  PERFORM pg_temp.prospecto_denegado(NULL, v_empresa, '42501', 'LC_SIN_ORGANIZACION', 'JWT sin usuario');
  PERFORM pg_temp.prospecto_denegado(v_sin_org, v_empresa, '42501', 'LC_SIN_ORGANIZACION', 'vendedor global sin membresia');
  UPDATE public.organizations SET activo = false WHERE id = fx.org_a;
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'Permisos insuficientes', 'membresia vendedor en organizacion inactiva');
  UPDATE public.organizations SET activo = true WHERE id = fx.org_a;

  -- Cliente es terminal para esta capacidad KAM, con y sin oportunidad para
  -- congelar tambien el caso que antes retornaba idempotentemente.
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, NULL, 'Cliente');
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, 'P0001', 'LC_CRM_EMPRESA_YA_CLIENTE', 'empresa Cliente sin oportunidad');
  v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
  v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead);
  UPDATE public.crm_empresas SET cliente_id = v_cliente WHERE id = v_empresa;
  PERFORM pg_temp.prospecto_oportunidad(fx.org_a, v_kam, v_lead, v_etapa_a, v_empresa);
  PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, 'P0001', 'LC_CRM_EMPRESA_YA_CLIENTE', 'empresa con cliente y oportunidad');

  -- Links de lead historicos: crm_empresas.lead_origen_id no tiene FK ni
  -- trigger de pertenencia. Se insertan como owner, sin omitir triggers.
  FOREACH v_caso IN ARRAY ARRAY['ajeno', 'sin propietario', 'borrado', 'cross-org', 'inexistente', 'convertido', 'cliente convertido'] LOOP
    v_lead := CASE v_caso
      WHEN 'ajeno' THEN pg_temp.prospecto_lead(fx.org_a, v_otro)
      WHEN 'sin propietario' THEN pg_temp.prospecto_lead(fx.org_a, NULL)
      WHEN 'borrado' THEN pg_temp.prospecto_lead(fx.org_a, v_kam, 'Prospecto', now())
      WHEN 'cross-org' THEN pg_temp.prospecto_lead(fx.org_b, v_kam)
      WHEN 'inexistente' THEN gen_random_uuid()
      WHEN 'convertido' THEN pg_temp.prospecto_lead(fx.org_a, v_kam, 'Convertido')
      ELSE pg_temp.prospecto_lead(fx.org_a, v_kam, 'Prospecto', NULL, v_cliente) END;
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead);
    PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'lead ' || v_caso);
  END LOOP;

  -- Oportunidades tienen FK y guards de origen reales: para cross-org se usa
  -- lead y etapa validos de B; para lead_id NULL, cliente vivo de A. El link
  -- empresa-oportunidad permite preparar el desajuste sin desactivar guards.
  FOREACH v_caso IN ARRAY ARRAY['ajena', 'sin propietario', 'borrada', 'cross-org', 'link cross-org', 'lead incongruente', 'sin lead', 'empresa sin lead'] LOOP
    v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam,
      CASE WHEN v_caso = 'empresa sin lead' THEN NULL ELSE v_lead END, 'Prospecto');
    v_otro_lead := pg_temp.prospecto_lead(CASE WHEN v_caso = 'cross-org' THEN fx.org_b ELSE fx.org_a END, v_kam);
    v_op := pg_temp.prospecto_oportunidad(
      CASE WHEN v_caso = 'cross-org' THEN fx.org_b ELSE fx.org_a END,
      CASE WHEN v_caso = 'ajena' THEN v_otro WHEN v_caso = 'sin propietario' THEN NULL ELSE v_kam END,
      CASE WHEN v_caso = 'sin lead' THEN NULL WHEN v_caso IN ('cross-org', 'lead incongruente') THEN v_otro_lead ELSE v_lead END,
      CASE WHEN v_caso = 'cross-org' THEN v_etapa_b ELSE v_etapa_a END, v_empresa,
      CASE WHEN v_caso = 'link cross-org' THEN fx.org_b ELSE fx.org_a END,
      CASE WHEN v_caso = 'borrada' THEN now() ELSE NULL END,
      CASE WHEN v_caso = 'sin lead' THEN v_cliente ELSE NULL END);
    PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'oportunidad ' || v_caso);
  END LOOP;

  -- Una oportunidad favorable no puede ocultar otra ajena/borrada: ambas
  -- posiciones de created_at y estado Lead/Prospecto ejercen el viejo LIMIT 1
  -- y su retorno idempotente antes de cualquier escritura.
  FOREACH v_caso IN ARRAY ARRAY['ajena despues', 'ajena antes', 'borrada despues'] LOOP
    v_lead := pg_temp.prospecto_lead(fx.org_a, v_kam);
    v_empresa := pg_temp.prospecto_empresa(fx.org_a, v_kam, v_lead,
      CASE WHEN v_caso = 'ajena antes' THEN 'Lead' ELSE 'Prospecto' END);
    v_op := pg_temp.prospecto_oportunidad(fx.org_a, v_kam, v_lead, v_etapa_a, v_empresa,
      NULL, NULL, NULL, now());
    v_otra_op := pg_temp.prospecto_oportunidad(fx.org_a,
      CASE WHEN v_caso = 'borrada despues' THEN v_kam ELSE v_otro END,
      v_lead, v_etapa_a, v_empresa, NULL,
      CASE WHEN v_caso = 'borrada despues' THEN now() ELSE NULL END, NULL,
      CASE WHEN v_caso = 'ajena antes' THEN now() - interval '1 minute' ELSE now() + interval '1 minute' END);
    PERFORM pg_temp.prospecto_denegado(v_kam, v_empresa, '42501', 'LC_CRM_PROSPECTO_VINCULO_INVALIDO', 'mezcla propia y ' || v_caso);
  END LOOP;

  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'OK - prospecto KAM: propiedad, membresia efectiva, 17 roles, plataforma, tenants, links, soft delete e idempotencia sin escrituras';
END;
$$;

ROLLBACK;
