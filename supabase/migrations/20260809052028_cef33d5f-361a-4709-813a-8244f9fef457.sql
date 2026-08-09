-- =====================================================================
-- Ola 1 · C2: helpers de autorización fail-closed cuando el usuario no
-- tiene organización resuelta (rol global sin membresía).
-- =====================================================================

CREATE OR REPLACE FUNCTION public._assert_writer(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF NOT v_super AND (v_org IS NULL OR p_org IS NULL) THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_super
    OR (
      p_org = v_org
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'contador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_writer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_writer(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_internal_reader(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF NOT v_super AND (v_org IS NULL OR p_org IS NULL) THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_super
    OR (
      p_org = v_org
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'contador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_internal_reader(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_internal_reader(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_writer_cotizacion(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF NOT v_super AND (v_org IS NULL OR p_org IS NULL) THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_super
    OR (
      p_org = v_org
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'ejecutivo_pricing'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_writer_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_writer_cotizacion(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Guards inline: `X <> v_caller_org` es NULL cuando el llamante no tiene
-- organización → `IF NOT NULL` no lanza excepción (fail-open). Se cambia a
-- `IS DISTINCT FROM`, que sí es verdadero contra NULL (fail-closed).
-- Se parchea el texto de cada función preservando el resto del cuerpo.
-- ---------------------------------------------------------------------
DO $do$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (
         p.prosrc LIKE '%<> v_caller_org%'
         OR p.prosrc LIKE '%<>v_caller_org%'
         OR p.prosrc LIKE '%<> public.current_user_org_id()%'
         OR p.prosrc LIKE '%<> current_user_org_id()%'
       )
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := replace(v_def, '<> v_caller_org', 'IS DISTINCT FROM v_caller_org');
    v_new := replace(v_new, '<>v_caller_org', ' IS DISTINCT FROM v_caller_org');
    v_new := replace(v_new, '<> public.current_user_org_id()', 'IS DISTINCT FROM public.current_user_org_id()');
    v_new := replace(v_new, '<> current_user_org_id()', 'IS DISTINCT FROM current_user_org_id()');
    IF v_new <> v_def THEN
      EXECUTE v_new;
      RAISE NOTICE 'C2 fail-closed aplicado a public.%', r.proname;
    END IF;
  END LOOP;
END
$do$;