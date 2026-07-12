-- 1) SUPA_rls_policy_always_true: endurecer políticas permisivas con USING(true)/WITH CHECK(true).
--    a) `cotizacion_costos_historico`: la única política permisiva ALL con true/true. Restringir a service_role.
DROP POLICY IF EXISTS "Service role historico cotizacion" ON public.cotizacion_costos_historico;
CREATE POLICY "Service role historico cotizacion"
  ON public.cotizacion_costos_historico
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

--    b) Las 29 políticas RESTRICTIVE "Hide soft deleted X" tenían WITH CHECK (true). El USING ya filtra deleted_at
--       IS NULL; espejamos el WITH CHECK para bloquear también intentos de escribir/actualizar hacia el estado borrado.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tablename, p.polname
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polpermissive = false
      AND p.polname LIKE 'Hide soft deleted%'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL)',
      r.polname, r.tablename
    );
  END LOOP;
END $$;

-- 2) navieras / puertos / tipos_contenedor: eliminar "Admins CRUD" (permite a cualquier admin de cualquier org
--    modificar catálogos globales). Se conserva "Super admin CRUD" para escritura y "Autenticados pueden leer" para SELECT.
DROP POLICY IF EXISTS "Admins CRUD navieras"         ON public.navieras;
DROP POLICY IF EXISTS "Admins CRUD puertos"          ON public.puertos;
DROP POLICY IF EXISTS "Admins CRUD tipos_contenedor" ON public.tipos_contenedor;

-- 3) user_roles: quitar el brazo que permitía a un admin ver roles de otros usuarios de su organización.
--    Solo el propio usuario ve sus roles; los super_admin siguen viendo todo vía "Super admins manage all roles".
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4) Backups estancos (_backup_*): datos sensibles legacy. Confirmamos que RLS quede activo y sin políticas
--    (deny-by-default para authenticated/anon; solo service_role puede leerlos). Además REVOKE explícito por si
--    algún GRANT histórico quedó vigente.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '\_backup\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('COMMENT ON TABLE public.%I IS %L', t,
      'Backup histórico. RLS forzado + sin políticas: solo accesible con service_role. Evaluar drop tras retención.');
  END LOOP;
END $$;