CREATE OR REPLACE FUNCTION public.guard_cxp_cancelacion_rol_financiero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rol public.app_role;
  c_permitidos public.app_role[] := ARRAY[
    'admin', 'super_admin', 'admin_org', 'contador', 'auxiliar_contable', 'tesorero'
  ]::public.app_role[];
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF NEW.estado <> 'Cancelada'::public.estado_proveedor_factura THEN RETURN NEW; END IF;
  IF v_uid IS NULL OR auth.role() = 'service_role' THEN RETURN NEW; END IF;

  -- El rol operativo vive en organization_members (rol_efectivo);
  -- user_roles queda como fallback para roles de plataforma.
  v_rol := public.rol_efectivo(v_uid, NEW.organization_id);

  IF NOT (v_rol = ANY (c_permitidos)
          OR public.has_role(v_uid, 'admin'::app_role)
          OR public.has_role(v_uid, 'super_admin'::app_role)
          OR public.has_role(v_uid, 'admin_org'::app_role)
          OR public.has_role(v_uid, 'contador'::app_role)
          OR public.has_role(v_uid, 'auxiliar_contable'::app_role)
          OR public.has_role(v_uid, 'tesorero'::app_role)) THEN
    RAISE EXCEPTION 'LC_CXP_CANCELAR_FORBIDDEN: tu rol no puede cancelar facturas de proveedor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_cxp_cancelacion_rol_financiero() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_cxp_cancelacion_rol_financiero() TO authenticated, service_role;