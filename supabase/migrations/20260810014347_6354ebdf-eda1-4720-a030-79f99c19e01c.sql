-- 1) Tabla de tenant activo por super admin
CREATE TABLE IF NOT EXISTS public.super_admin_org_activa (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_org_activa TO authenticated;
GRANT ALL ON public.super_admin_org_activa TO service_role;

ALTER TABLE public.super_admin_org_activa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin maneja su tenant activo" ON public.super_admin_org_activa;
CREATE POLICY "Super admin maneja su tenant activo"
  ON public.super_admin_org_activa FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS trg_super_admin_org_activa_updated_at ON public.super_admin_org_activa;
CREATE TRIGGER trg_super_admin_org_activa_updated_at
  BEFORE UPDATE ON public.super_admin_org_activa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Organización efectiva
CREATE OR REPLACE FUNCTION public.org_scope()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin')
      THEN (SELECT s.organization_id FROM public.super_admin_org_activa s WHERE s.user_id = auth.uid())
    ELSE public.current_user_org_id()
  END
$$;

REVOKE ALL ON FUNCTION public.org_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_scope() TO authenticated, service_role;

-- 3) RPC para fijar / limpiar el tenant activo del super admin
CREATE OR REPLACE FUNCTION public.set_super_admin_org(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sólo el super admin puede cambiar de organización';
  END IF;

  IF p_org IS NULL THEN
    DELETE FROM public.super_admin_org_activa WHERE user_id = auth.uid();
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org) THEN
    RAISE EXCEPTION 'LC_ORG_INEXISTENTE: la organización no existe';
  END IF;

  INSERT INTO public.super_admin_org_activa (user_id, organization_id)
  VALUES (auth.uid(), p_org)
  ON CONFLICT (user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_super_admin_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_super_admin_org(uuid) TO authenticated;

-- 4) Reescritura del predicado cross-org en las funciones de agregación
DO $mig$
DECLARE
  r record;
  v_def text;
  v_new text;
  v_pat text := $q$current_user_org_id\(\)\s*OR\s+has_role\(\s*auth\.uid\(\)\s*,\s*'super_admin'(::app_role)?\s*\)$q$;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT oid, proname FROM (
      SELECT p.oid, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'          -- excluye agregados/ventana/procedimientos
        AND p.prolang <> 'c'::regtype::oid
        AND p.prosrc ~ v_pat
    ) cand
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_def, v_pat, 'public.org_scope()', 'g');
    IF v_new <> v_def THEN
      EXECUTE v_new;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Funciones reescritas con org_scope(): %', v_count;
END;
$mig$;