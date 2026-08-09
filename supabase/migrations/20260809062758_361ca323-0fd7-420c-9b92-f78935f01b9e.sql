-- Ola 4 · C1 (resto): fail-closed de organización en listados operativos.
CREATE OR REPLACE FUNCTION public.org_requerida(p_org uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  v_org := COALESCE(p_org, public.current_user_org_id());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_REQUERIDA: selecciona una organización para ver esta información'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.org_requerida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_requerida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_requerida(uuid) TO service_role;

DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  -- embarques_listado: `$1 IS NULL` significaba "sin filtro de organización".
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'embarques_listado'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.embarques_listado';
  END IF;
  v_new := replace(v_def,
    'AND ( $1 IS NULL OR e.organization_id = $1 )',
    'AND e.organization_id = public.org_requerida($1)');
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patch no aplicado en public.embarques_listado (patrón no encontrado)';
  END IF;
  EXECUTE v_new;

  -- facturas_listado: mismo patrón, lenguaje SQL.
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'facturas_listado'
   LIMIT 1;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'No se encontró public.facturas_listado';
  END IF;
  v_new := replace(v_def,
    'AND ( p_organization_id IS NULL OR f.organization_id = p_organization_id )',
    'AND f.organization_id = public.org_requerida(p_organization_id)');
  IF v_new = v_def THEN
    RAISE EXCEPTION 'Patch no aplicado en public.facturas_listado (patrón no encontrado)';
  END IF;
  EXECUTE v_new;
END
$do$;

-- Ola 4 · M1: prohibir roles globales de plataforma en membresías de organización.
CREATE OR REPLACE FUNCTION public._bloquear_rol_plataforma_om()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text = 'super_admin' THEN
    RAISE EXCEPTION 'LC_ROL_PLATAFORMA_NO_PERMITIDO: el rol super_admin no puede asignarse desde la membresía de una organización'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._bloquear_rol_plataforma_om() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bloquear_rol_plataforma_om() TO service_role;

DROP TRIGGER IF EXISTS trg_bloquear_rol_plataforma_om ON public.organization_members;
CREATE TRIGGER trg_bloquear_rol_plataforma_om
  BEFORE INSERT OR UPDATE OF role ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_rol_plataforma_om();

-- Ola 4 · M2: WITH CHECK no aplica a DELETE — política de borrado explícita.
DROP POLICY IF EXISTS "Agente CRUD own tarifas" ON public.costeo_tarifas;

CREATE POLICY "Agente escribe own tarifas"
  ON public.costeo_tarifas
  FOR ALL TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'agente_carga')
    AND agente_id = current_agente_id()
    AND organization_id = current_agente_org()
  )
  WITH CHECK (
    has_role((SELECT auth.uid()), 'agente_carga')
    AND agente_id = current_agente_id()
    AND organization_id = current_agente_org()
    AND estado_aprobacion IN ('borrador','rechazada')
  );

CREATE POLICY "Agente borra solo tarifas no aprobadas"
  ON public.costeo_tarifas
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (
    NOT has_role((SELECT auth.uid()), 'agente_carga')
    OR estado_aprobacion IN ('borrador','rechazada')
  );