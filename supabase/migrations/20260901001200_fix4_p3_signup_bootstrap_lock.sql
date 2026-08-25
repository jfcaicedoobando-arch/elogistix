-- ============================================================================
-- FIX4 tanda 4 · P3 · Carrera en el bootstrap super_admin del signup
--
-- handle_new_user_signup hace SELECT count(*) FROM user_roles y, si es 0,
-- corona al nuevo usuario como super_admin global. Sin bloqueo, dos signups
-- concurrentes del sistema vacío leen 0 a la vez y AMBOS quedan super_admin
-- (race verificada en vivo con dos sesiones: 2 coronas en el bootstrap).
--
-- Fix: pg_advisory_xact_lock con clave estable alrededor del chequeo del
-- bootstrap. El lock es transaccional (se libera al commit/rollback del
-- signup) y serializa sólo el bootstrap; el resto del flujo (creación de
-- organización) no toca user_roles globales y queda igual.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company_name text;
  v_org_id uuid;
  v_user_count int;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  IF v_skip THEN
    RETURN NEW;
  END IF;

  -- FIX4 P3: serializa el bootstrap super_admin. Clave estable derivada del
  -- nombre lógico del candado (hashtextextended → bigint). Dos signups
  -- concurrentes ya no pueden leer count(*)=0 a la vez: el segundo espera al
  -- commit del primero y ve la corona ya puesta.
  PERFORM pg_advisory_xact_lock(hashtextextended('elogistix.bootstrap_super_admin', 0));

  -- Bootstrap: primer usuario del sistema recibe super_admin global.
  SELECT count(*) INTO v_user_count FROM public.user_roles;
  IF v_user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Sólo crear organización si el usuario proporcionó nombre de empresa.
  v_company_name := trim(coalesce(NEW.raw_user_meta_data->>'company_name', ''));
  IF length(v_company_name) = 0 THEN
    -- Sin company_name: NO se crea org ni membresía; el rol/membresía se fijan
    -- vía onboarding o invitación posterior.
    RETURN NEW;
  END IF;

  IF length(v_company_name) > 120 THEN
    v_company_name := substring(v_company_name FROM 1 FOR 120);
  END IF;

  INSERT INTO public.organizations (nombre, plan, activo)
  VALUES (v_company_name, 'basic', true) RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'admin_org'::public.app_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END $function$;

-- Sin cambios de GRANT/REVOKE: CREATE OR REPLACE preserva las ACLs vigentes
-- y la función la invoca el trigger de auth.users, no roles de la API.
