-- =============================================================
-- roles_membership_mirror.sql
--
-- Regresión del desfase de roles que rompía RLS (42501):
-- `public.has_role()` lee SÓLO `public.user_roles`, pero los roles se
-- administran en `public.organization_members`. 10 de 19 membresías no
-- tenían espejo, así que esos usuarios (p. ej. un `vendedor`) fallaban al
-- insertar en `public.cotizaciones` aunque la política sí permite su rol.
--
-- Fix: trigger `_sync_user_roles_desde_membership()` en
-- `organization_members` + backfill.
--
-- Casos:
--   1) alta de membresía crea el espejo en user_roles
--   2) cambio de rol reemplaza el espejo (user_roles es UNIQUE(user_id))
--   3) baja de membresía retira el espejo
--   4) roles de plataforma/legacy no generan espejo
--   5) invariante global: cero membresías sin espejo
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/roles_membership_mirror.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org  uuid := '11111111-1111-1111-1111-1111111111c1';
  v_user uuid := '22222222-2222-2222-2222-2222222222c1';
  v_rol  text;
  v_n    int;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org MIRROR') ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email)
  VALUES (v_user, 'mirror-test@test.mx') ON CONFLICT (id) DO NOTHING;

  -- ---------------------------------------------------------------
  -- Caso 1: alta de membresía crea el espejo
  -- ---------------------------------------------------------------
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_user, 'vendedor');

  SELECT role::text INTO v_rol FROM public.user_roles WHERE user_id = v_user;
  IF v_rol IS DISTINCT FROM 'vendedor' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: espejo esperado "vendedor", obtenido %', COALESCE(v_rol, '<nulo>');
  END IF;

  -- ---------------------------------------------------------------
  -- Caso 2: cambio de rol reemplaza el espejo
  -- ---------------------------------------------------------------
  UPDATE public.organization_members
     SET role = 'gerente_comercial'
   WHERE organization_id = v_org AND user_id = v_user;

  SELECT role::text INTO v_rol FROM public.user_roles WHERE user_id = v_user;
  IF v_rol IS DISTINCT FROM 'gerente_comercial' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: espejo esperado "gerente_comercial", obtenido %', COALESCE(v_rol, '<nulo>');
  END IF;

  SELECT count(*) INTO v_n FROM public.user_roles WHERE user_id = v_user;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: user_roles debe tener 1 fila por usuario, hay %', v_n;
  END IF;

  -- ---------------------------------------------------------------
  -- Caso 3: baja de membresía retira el espejo
  -- ---------------------------------------------------------------
  DELETE FROM public.organization_members
   WHERE organization_id = v_org AND user_id = v_user;

  SELECT count(*) INTO v_n FROM public.user_roles WHERE user_id = v_user;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el espejo debió retirarse, quedan % fila(s)', v_n;
  END IF;

  -- ---------------------------------------------------------------
  -- Caso 4: roles de plataforma no generan espejo
  -- (`_bloquear_rol_plataforma_om` puede rechazar super_admin en
  --  organization_members; ambos desenlaces son válidos: lo prohibido es
  --  que aparezca un espejo super_admin.)
  -- ---------------------------------------------------------------
  BEGIN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org, v_user, 'super_admin');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT count(*) INTO v_n
    FROM public.user_roles
   WHERE user_id = v_user AND role::text = 'super_admin';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: se creó espejo super_admin (escalada de privilegios)';
  END IF;

  RAISE NOTICE 'roles_membership_mirror: casos 1-4 OK';
END;
$fixture$;

-- ---------------------------------------------------------------
-- Caso 5: invariante global — cero membresías sin espejo
-- ---------------------------------------------------------------
DO $inv$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM public.organization_members om
   WHERE om.role::text NOT IN ('super_admin', 'admin', 'operador', 'viewer')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = om.user_id
          AND ur.role = om.role
     );

  IF v_n > 0 THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: % membresía(s) sin espejo en user_roles (RLS 42501 latente)', v_n;
  END IF;

  RAISE NOTICE 'roles_membership_mirror: caso 5 OK — sin membresías huérfanas';
END;
$inv$;

ROLLBACK;
