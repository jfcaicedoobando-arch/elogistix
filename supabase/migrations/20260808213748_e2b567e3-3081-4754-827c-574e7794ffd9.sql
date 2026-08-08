CREATE OR REPLACE FUNCTION public.eliminar_organizacion_vacia(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'No autorizado para eliminar organizaciones' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_org_id = '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'No se puede eliminar la organización principal del sistema' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organización no encontrada' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COALESCE(SUM(n), 0) INTO v_count
  FROM (
    SELECT COUNT(*) AS n FROM public.embarques          WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.clientes       WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.proveedores    WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.cotizaciones   WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.proformas     WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.facturas       WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.pagos_proveedor WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.pagos_factura  WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.cuentas_bancarias WHERE organization_id = p_org_id
    UNION ALL SELECT COUNT(*) FROM public.crm_oportunidades WHERE organization_id = p_org_id AND deleted_at IS NULL
    UNION ALL SELECT COUNT(*) FROM public.crm_leads       WHERE organization_id = p_org_id AND deleted_at IS NULL
  ) t;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'La organización tiene % registro(s) de negocio. Solo se pueden eliminar organizaciones vacías; desactívala en su lugar.', v_count
      USING ERRCODE = 'check_violation';
  END IF;

  DELETE FROM public.bitacora_actividad WHERE organization_id = p_org_id;
  DELETE FROM public.configuracion      WHERE organization_id = p_org_id;
  DELETE FROM public.organization_members WHERE organization_id = p_org_id;

  BEGIN
    DELETE FROM public.organizations WHERE id = p_org_id;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'La organización tiene datos en otras tablas y no se puede eliminar. Desactívala en su lugar.'
      USING ERRCODE = 'foreign_key_violation';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_organizacion_vacia(uuid) TO authenticated;
-- H6: la función SECURITY DEFINER no debe ser ejecutable por PUBLIC/anon
REVOKE ALL ON FUNCTION public.eliminar_organizacion_vacia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_organizacion_vacia(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_organizacion_vacia(uuid) TO service_role;
