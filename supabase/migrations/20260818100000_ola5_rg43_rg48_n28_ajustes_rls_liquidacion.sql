-- =====================================================================
-- Ola 5 · RG4-3: la versión vigente (20260817090200, fix N52) ejecuta el
-- DELETE de puentes proveedor_facturas_conceptos ANTES del UPDATE de
-- soft-delete que los usa como localizador → el UPDATE matchea 0 filas →
-- cada re-edición de la factura deja los ajustes previos VIVOS y sin
-- puente → doble conteo de costos.
-- =====================================================================
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
  v_previos uuid[];
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

  -- N6: todo embarque_id del payload debe ser un embarque vigente de la
  -- MISMA organización que la factura.
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

  -- Ola 5 · RG4-3: capturar ANTES de cualquier DELETE los ids de todos los
  -- conceptos de ajuste de esta factura (vivos o ya soft-borrados).
  SELECT COALESCE(array_agg(pfc.concepto_costo_id), '{}'::uuid[])
    INTO v_previos
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND cc.origen = 'ajuste_factura_proveedor';

  -- Idempotencia (paso 1): soft-delete de los ajustes previos vivos.
  UPDATE public.conceptos_costo cc
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE cc.deleted_at IS NULL
     AND cc.id = ANY (v_previos);

  -- Idempotencia (paso 2): borrar los puentes de esos mismos ids.
  DELETE FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id = ANY (v_previos);

  -- Conceptos de ajuste + puentes, atómicos.
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

REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO authenticated, service_role;

-- =====================================================================
-- Ola 5 · RG4-8: alinear las policies de bbva_movimientos con la matriz
-- CAPTURAR_MOVIMIENTO_BANCARIO, que incluye auxiliar_contable.
-- =====================================================================
DROP POLICY IF EXISTS "Tesoreria read bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria read bbva_movimientos"
  ON public.bbva_movimientos FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role))
    )
  );

DROP POLICY IF EXISTS "Tesoreria write bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria write bbva_movimientos"
  ON public.bbva_movimientos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role))
    )
  );

DROP POLICY IF EXISTS "Tesoreria update bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria update bbva_movimientos"
  ON public.bbva_movimientos FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role))
    )
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role))
    )
  );

-- =====================================================================
-- Ola 5 · N28: el tesorero ya autorizado por has_any_role_efectivo moría
-- con 42501 en _assert_writer al GENERAR la liquidación de comisiones.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(
  p_vendedora_id uuid, p_periodo text, p_organization_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
BEGIN
  -- Ola 5 · N28: una sola puerta de rol, la misma matriz que liq_admin_full.
  IF NOT has_any_role_efectivo(auth.uid(),
        ARRAY['admin','admin_org','contador','tesorero']::app_role[]) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;

  -- Ola 5 · N28: antes PERFORM public._assert_writer(v_org) — su set
  -- {admin, operador, contador} contradecía al guard de arriba y dejaba
  -- fuera al tesorero con 42501. Se conserva sólo el fail-closed de org.
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  RETURN v_liq_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid) TO authenticated, service_role;