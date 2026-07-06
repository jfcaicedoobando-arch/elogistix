-- Ola 2 · Item 4 — Cancelación de factura de proveedor

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS fecha_cancelacion timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.cancelar_factura_proveedor(
  p_factura_id uuid,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado public.estado_proveedor_factura;
  v_deleted timestamptz;
  v_org uuid;
  v_pagado numeric;
  v_ncs_canceladas int;
  v_uid uuid := auth.uid();
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debes indicar un motivo de cancelación.' USING ERRCODE = '22023';
  END IF;

  SELECT estado, deleted_at, organization_id
    INTO v_estado, v_deleted, v_org
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes de cancelarla.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;

  -- Permiso por organización (mismo criterio que las policies existentes).
  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta factura.' USING ERRCODE = '42501';
  END IF;

  -- Bloquear si tiene pagos activos.
  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'No puedes cancelar la factura: tiene pagos aplicados por %. Elimina o anula los pagos primero.', v_pagado
      USING ERRCODE = '22023';
  END IF;

  -- Cancelar NCs activas asociadas (revierte NC).
  UPDATE public.proveedor_notas_credito
     SET estado = 'Cancelada'::public.estado_nota_credito_proveedor,
         updated_at = now()
   WHERE proveedor_factura_id = p_factura_id
     AND deleted_at IS NULL
     AND estado <> 'Cancelada'::public.estado_nota_credito_proveedor;
  GET DIAGNOSTICS v_ncs_canceladas = ROW_COUNT;

  -- Cancelar la factura. El trigger trg_proveedor_facturas_recalc_liq
  -- recalcula estado_liquidacion en los conceptos_costo asociados.
  UPDATE public.proveedor_facturas
     SET estado = 'Cancelada'::public.estado_proveedor_factura,
         fecha_cancelacion = now(),
         motivo_cancelacion = btrim(p_motivo),
         cancelada_por = v_uid,
         updated_at = now()
   WHERE id = p_factura_id;

  -- Bitácora (si la tabla existe en el proyecto).
  IF to_regclass('public.bitacora_actividad') IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (organization_id, user_id, tipo, entidad, entidad_id, descripcion, metadata)
    VALUES
      (v_org, v_uid, 'cancelacion', 'proveedor_factura', p_factura_id,
       'Factura de proveedor cancelada',
       jsonb_build_object('motivo', btrim(p_motivo), 'ncs_canceladas', v_ncs_canceladas));
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.cancelar_factura_proveedor(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cancelar_factura_proveedor(uuid, text) FROM anon;