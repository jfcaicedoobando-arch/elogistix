CREATE OR REPLACE FUNCTION public.soft_delete_proveedor_factura(
  p_factura_id uuid,
  p_deleted_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.proveedor_facturas%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_is_allowed boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LC_AUTH_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  SELECT *
    INTO v_factura
    FROM public.proveedor_facturas
   WHERE id = p_factura_id
   FOR UPDATE;

  IF NOT FOUND OR v_factura.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROVEEDOR_NOT_FOUND'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT
    public.has_role(v_user_id, 'super_admin'::public.app_role)
    OR public.has_role(v_user_id, 'admin'::public.app_role)
    OR public.has_role(v_user_id, 'contador'::public.app_role)
    OR public.has_role(v_user_id, 'auxiliar_contable'::public.app_role)
    OR public.has_role(v_user_id, 'tesorero'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = v_user_id
        AND om.organization_id = v_factura.organization_id
        AND om.role IN (
          'admin_org'::public.app_role,
          'admin'::public.app_role,
          'contador'::public.app_role,
          'auxiliar_contable'::public.app_role,
          'tesorero'::public.app_role
        )
    )
    INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'LC_FORBIDDEN_FACTURA_PROVEEDOR_DELETE'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.proveedor_facturas
     SET deleted_at = now(),
         deleted_by = COALESCE(p_deleted_by, v_user_id),
         updated_at = now()
   WHERE id = p_factura_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_proveedor_factura(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_proveedor_factura(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_proveedor_factura(uuid, uuid) TO service_role;