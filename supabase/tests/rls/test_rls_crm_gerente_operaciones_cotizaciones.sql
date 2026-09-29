-- Regresión: Gerencia de Operaciones puede leer el mínimo necesario para
-- cotizar prospectos calificados, pero no obtiene escritura del CRM.
BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  ops_user uuid := gen_random_uuid();
  lead_qualified uuid := gen_random_uuid();
  lead_new uuid := gen_random_uuid();
  lead_other_org uuid := gen_random_uuid();
  lead_insert uuid := gen_random_uuid();
  visible int;
  blocked boolean := false;
BEGIN
  INSERT INTO public.organizations(id, nombre)
  VALUES (org_a, 'RLS Ops Quote A'), (org_b, 'RLS Ops Quote B');

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (org_a, ops_user, 'gerente_operaciones');
  INSERT INTO public.user_roles(user_id, role)
  VALUES (ops_user, 'gerente_operaciones')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.crm_leads(
    id, organization_id, empresa, contacto, email, telefono, pais, ciudad,
    fuente, interes_modo, score, estado, vendedor_email, notas
  ) VALUES
    (lead_qualified, org_a, 'Prospecto cotizable', 'Contacto QA',
     'contacto@qa.test', '8180000000', 'MX', 'Monterrey', 'Referido',
     'Marítimo', 5, 'Calificado', 'kam@qa.test', ''),
    (lead_new, org_a, 'Prospecto no calificado', '', '', '', 'MX',
     'Monterrey', 'Referido', 'Marítimo', 1, 'Nuevo', 'kam@qa.test', ''),
    (lead_other_org, org_b, 'Prospecto de otra organización', '', '', '',
     'MX', 'Monterrey', 'Referido', 'Marítimo', 80, 'Calificado',
     'kam@qa.test', '');

  PERFORM pg_temp.as_user(ops_user);

  -- La consulta usada por cotizaciones sólo ve prospectos elegibles de su org.
  SELECT COUNT(*) INTO visible
  FROM public.crm_leads
  WHERE id IN (lead_qualified, lead_new, lead_other_org);
  PERFORM pg_temp.assert(visible = 1,
    format('Gerencia de Operaciones vio %s leads; esperaba sólo el prospecto calificado propio', visible));

  -- La capacidad añadida es de lectura, no autoriza la edición del lead.
  UPDATE public.crm_leads
  SET empresa = 'No debe modificarse'
  WHERE id = lead_qualified;

  PERFORM pg_temp.as_postgres();
  SELECT COUNT(*) INTO visible
  FROM public.crm_leads
  WHERE id = lead_qualified AND empresa = 'No debe modificarse';
  PERFORM pg_temp.assert(visible = 0,
    'Gerencia de Operaciones modificó un prospecto CRM');

  -- Tampoco puede insertar directamente un lead mediante la nueva policy.
  PERFORM pg_temp.as_user(ops_user);
  BEGIN
    INSERT INTO public.crm_leads(
      id, organization_id, empresa, contacto, email, telefono, pais, ciudad,
      fuente, interes_modo, score, estado, vendedor_email, notas
    ) VALUES (
      lead_insert, org_a, 'Lead no autorizado', '', '', '', 'MX',
      'Monterrey', 'Referido', 'Marítimo', 50, 'Calificado', 'ops@qa.test', ''
    );
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      blocked := true;
  END;
  PERFORM pg_temp.assert(blocked,
    'Gerencia de Operaciones insertó un lead CRM');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'OK: gerente_operaciones cotiza prospectos calificados sin escritura CRM';
END;
$$;

ROLLBACK;
