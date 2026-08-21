-- ============================================================================
-- Ola 6 · O6.1 — Bolsa común de leads ("Ventas arranca")
--
-- Problema: la policy "Vendedor own crm_leads" exige vendedor_id = auth.uid(),
-- por lo que los leads SIN asignar eran invisibles para los vendedores y nadie
-- podía tomarlos de una bolsa común.
--
-- Cambio:
--   1) Policy de lectura "Vendedor bolsa crm_leads": el rol vendedor (y su
--      jerarquía: gerente_comercial/admin_org/super_admin vía has_role) ve los
--      leads de su organización con vendedor_id IS NULL. Sólo SELECT: la
--      asignación se hace exclusivamente por la RPC crm_tomar_lead.
--   2) RPC public.crm_tomar_lead(p_lead_id): SECURITY DEFINER, valida org,
--      toma el renglón FOR UPDATE (dos tomas simultáneas → la segunda recibe
--      LC_LEAD_YA_ASIGNADO), asigna vendedor_id = auth.uid().
-- ============================================================================

-- 1) Lectura de la bolsa (leads sin asignar) para ventas.
CREATE POLICY "Vendedor bolsa crm_leads" ON public.crm_leads
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    AND public.has_role((SELECT auth.uid()), 'vendedor')
    AND vendedor_id IS NULL
  );

-- 2) Toma atómica de un lead de la bolsa.
CREATE OR REPLACE FUNCTION public.crm_tomar_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead public.crm_leads;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO';
  END IF;

  -- FOR UPDATE: serializa tomas simultáneas del mismo lead; la segunda
  -- transacción espera el lock y luego ve vendedor_id ya poblado.
  SELECT * INTO v_lead
  FROM public.crm_leads
  WHERE id = p_lead_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'LC_LEAD_NO_ENCONTRADO';
  END IF;
  IF NOT public.is_org_member(v_lead.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  -- has_role('vendedor') incluye gerente_comercial/admin_org/super_admin por
  -- la jerarquía (roles_jerarquia), igual que la policy "Vendedor own".
  IF NOT public.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RAISE EXCEPTION 'LC_LEAD_SIN_PERMISO_TOMA';
  END IF;

  -- Idempotente: re-tomar un lead ya propio no es error (doble click/retry).
  IF v_lead.vendedor_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'lead_id', v_lead.id,
      'vendedor_id', v_lead.vendedor_id,
      'tomado', false
    );
  END IF;
  IF v_lead.vendedor_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LEAD_YA_ASIGNADO';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.crm_leads
     SET vendedor_id = auth.uid(),
         vendedor_email = COALESCE(v_email, ''),
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'lead_id', v_lead.id,
    'vendedor_id', auth.uid(),
    'tomado', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_tomar_lead(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_tomar_lead(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_tomar_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_tomar_lead(uuid) TO service_role;