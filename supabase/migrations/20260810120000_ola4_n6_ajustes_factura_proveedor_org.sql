-- Ola 4 · N6: endurecer crear_ajustes_factura_proveedor_rpc.
--
-- N6 (ALTA, cross-tenant): la RPC insertaba conceptos_costo con el
--     embarque_id crudo del payload, sin validar que el embarque pertenezca
--     a la organización de la factura → inyección de costos en embarques
--     ajenos (explotable vía profit_por_cliente, ver N7). Ahora todo
--     embarque_id del payload debe existir, no estar borrado y ser de la
--     misma org de la factura; si no, se rechaza toda la llamada con
--     LC_EMBARQUE_AJENO (ERRCODE 42501).
--
-- Base: cuerpo vigente en BD (idéntico a 20260810052424), agregando
-- ÚNICAMENTE la validación de embarque. No se toca la lógica de
-- idempotencia ni los puentes (fuera de alcance de este fix).
CREATE OR REPLACE FUNCTION public.crear_ajustes_factura_proveedor_rpc(
  p_factura_id uuid,
  p_ajustes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fact public.proveedor_facturas%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_fact
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROVEEDOR_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_fact.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Ola 4 · N6: todo embarque_id del payload debe ser un embarque vigente de
  -- la MISMA organización que la factura. Antes se insertaba el id crudo del
  -- cliente → inyección de costos cross-tenant. Fail-closed: un solo ajuste
  -- inválido aborta toda la transacción (no hay escrituras parciales).
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
      AND NOT EXISTS (
        SELECT 1
        FROM public.embarques e
        WHERE e.id = (a->>'embarque_id')::uuid
          AND e.organization_id = v_fact.organization_id
          AND e.deleted_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'LC_EMBARQUE_AJENO: todo ajuste debe referenciar un embarque vigente de la misma organización que la factura'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: soft-delete de ajustes previos de esta factura.
  UPDATE public.conceptos_costo cc
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE cc.deleted_at IS NULL
     AND cc.origen = 'ajuste_factura_proveedor'
     AND cc.id IN (
       SELECT pfc.concepto_costo_id
       FROM public.proveedor_facturas_conceptos pfc
       WHERE pfc.proveedor_factura_id = p_factura_id
         AND pfc.concepto_costo_id IS NOT NULL
     );

  -- Conceptos de ajuste + puentes, atómicos. Los datos de la factura salen de
  -- la fila bloqueada: el cliente sólo envía [{embarque_id, descripcion, monto}].
  WITH nuevos AS (
    INSERT INTO public.conceptos_costo (
      embarque_id, organization_id, proveedor_id, proveedor_nombre,
      concepto, monto, moneda, origen,
      estado_liquidacion, fecha_pago, referencia_pago
    )
    SELECT
      (a->>'embarque_id')::uuid,
      v_fact.organization_id,
      v_fact.proveedor_id,
      v_fact.proveedor_nombre,
      'Ajuste factura ' || COALESCE(v_fact.folio_proveedor, '') || ': ' || COALESCE(a->>'descripcion', ''),
      (a->>'monto')::numeric,
      v_fact.moneda,
      'ajuste_factura_proveedor',
      'Pagado'::estado_liquidacion,
      v_fact.fecha_emision,
      v_fact.folio_proveedor
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
    RETURNING id, concepto, monto
  ),
  puentes AS (
    INSERT INTO public.proveedor_facturas_conceptos (
      proveedor_factura_id, organization_id, concepto_costo_id,
      descripcion, cantidad, monto
    )
    SELECT p_factura_id, v_fact.organization_id, n.id, n.concepto, 1, n.monto
    FROM nuevos n
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM puentes;

  RETURN jsonb_build_object('ajustes_creados', v_count, 'folio', v_fact.folio_proveedor);
END;
$$;

-- H6: permisos explícitos (idempotente).
REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO authenticated, service_role;
