-- Ola 4 · N37: RG10 (20260810061406) cambió el bloqueo de "folio externo con
-- texto" a "cualquier FK de factura no nulo", pero no valida que la factura
-- esté VIVA → proforma cuya factura fue cancelada/sustituida/borrada queda
-- imposible de eliminar para siempre. Base: 20260810061406 (íntegra); sólo
-- cambia el bloque del chequeo.
CREATE OR REPLACE FUNCTION public.eliminar_proforma_rpc(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_numero text;
  v_estado text;
  v_factura uuid;
  v_factura2 uuid;
  v_folio_ext text;
  v_deleted timestamptz;
  v_embarque uuid;
BEGIN
  SELECT organization_id, numero, estado_proforma, factura_id, factura_secundaria_id,
         folio_factura_externa, deleted_at, embarque_id
    INTO v_org, v_numero, v_estado, v_factura, v_factura2, v_folio_ext, v_deleted, v_embarque
  FROM public.proformas WHERE id = p_proforma_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', false);
  END IF;
  -- RG10: el folio externo suelto ya NO bloquea.
  -- Ola 4 · N37: tampoco bloquea una factura MUERTA (borrada, cancelada o
  -- sustituida) — sólo una factura viva ligada o el estado 'facturada'.
  IF EXISTS (
       SELECT 1 FROM public.facturas f
       WHERE f.id IN (v_factura, v_factura2)
         AND f.deleted_at IS NULL
         AND f.estado NOT IN ('Cancelada','Sustituida')
     )
     OR lower(COALESCE(v_estado, '')) = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA';
  END IF;

  UPDATE public.conceptos_venta
     SET estado_facturacion = 'pendiente', proforma_id = NULL
   WHERE proforma_id = p_proforma_id;

  UPDATE public.proformas
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_proforma_id;

  RETURN jsonb_build_object('numero', v_numero, 'embarque_id', v_embarque, 'eliminada', true);
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_proforma_rpc(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_proforma_rpc(uuid) TO service_role;
