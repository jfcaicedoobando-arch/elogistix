-- Fuente canónica. Espejo 1:1 de la migración v13.823.32 (ola de pulido CxP/cotización→embarque/CRM).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.programar_pago_proveedor(
  p_factura_id uuid,
  p_fecha date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_factura  public.proveedor_facturas;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO: inicia sesión para programar el pago' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_factura
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL
   FOR UPDATE;

  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  -- Roles EXACTOS y dentro de la organización de la factura (sin jerarquías).
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_factura.organization_id
         AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org','tesorero','contador'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: tu rol no puede programar pagos en esta organización' USING ERRCODE = '42501';
  END IF;

  IF v_factura.estado = 'Cancelada'::estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_CXP_CANCELADA: no se puede programar el pago de una factura cancelada' USING ERRCODE = 'P0001';
  END IF;

  IF p_fecha IS NOT NULL AND v_factura.fecha_emision IS NOT NULL AND p_fecha < v_factura.fecha_emision THEN
    RAISE EXCEPTION 'LC_CXP_FECHA_PROGRAMADA_INVALIDA: la fecha programada (%) no puede ser anterior a la emisión (%)',
      p_fecha, v_factura.fecha_emision USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.proveedor_facturas
     SET fecha_programada_pago = p_fecha, updated_at = now()
   WHERE id = p_factura_id;

  RETURN p_factura_id;
END;
$$;
