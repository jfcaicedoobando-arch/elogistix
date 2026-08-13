-- Ola 11 · RBD-07 (clase BL-04, "nunca 1:1 silencioso"):
-- regenerar_movimiento_pago_proveedor posteaba v_cargo = v_pago.monto tal cual
-- cuando la moneda del pago difería de la de la cuenta y el pago no tenía
-- tipo_cambio_usd. Ahora la rama cross-moneda EXIGE el TC registrado en el
-- pago o aborta con LC_PAGO_TC_REQUERIDO. Se conserva el fail-closed RG5-1.
CREATE OR REPLACE FUNCTION public.regenerar_movimiento_pago_proveedor(p_pago_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago         public.pagos_proveedor;
  v_org          uuid;
  v_cuenta_mon   text;
  v_cargo        numeric;
  v_concepto     text;
  v_mov_id       uuid;
BEGIN
  SELECT * INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = p_pago_id AND deleted_at IS NULL;

  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor no existe o está eliminado'
      USING ERRCODE = 'P0001';
  END IF;

  -- Ola 6 · RG5-1: fail-closed. Sin organización resuelta no hay forma de
  -- validar la pertenencia del pago: se niega.
  v_org := public.org_scope();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: no hay organización activa para validar el pago; selecciona una organización antes de regenerar el movimiento'
      USING ERRCODE = '42501';
  END IF;

  IF v_pago.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago pertenece a otra organización'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_any_role(auth.uid(), ARRAY['tesorero','contador','admin','admin_org','super_admin']::app_role[])
  ) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_PERMISO: se requiere permiso de tesorería para regenerar el movimiento bancario'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: el pago no tiene cuenta bancaria, no hay movimiento que generar'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bbva_movimientos
    WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_YA_EXISTE: el pago ya tiene un movimiento bancario vigente'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT moneda::text INTO v_cuenta_mon
  FROM public.cuentas_bancarias
  WHERE id = v_pago.cuenta_bancaria_id AND deleted_at IS NULL;

  IF v_cuenta_mon IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: la cuenta bancaria del pago no existe o está dada de baja'
      USING ERRCODE = 'P0001';
  END IF;

  -- El movimiento SIEMPRE se registra en la moneda de la cuenta.
  v_cargo := v_pago.monto;
  IF v_cuenta_mon IS DISTINCT FROM v_pago.moneda::text THEN
    -- Ola 11 · RBD-07 (clase BL-04): nunca 1:1 silencioso cross-moneda.
    IF COALESCE(v_pago.tipo_cambio_usd, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: el pago es en % y la cuenta en %, pero el pago no tiene tipo de cambio registrado; captura el TC en el pago antes de regenerar el movimiento',
        v_pago.moneda, v_cuenta_mon
        USING ERRCODE = 'P0001';
    END IF;
    IF v_pago.moneda::text = 'USD' AND v_cuenta_mon = 'MXN' THEN
      v_cargo := v_pago.monto * v_pago.tipo_cambio_usd;
    ELSIF v_pago.moneda::text = 'MXN' AND v_cuenta_mon = 'USD' THEN
      v_cargo := v_pago.monto / v_pago.tipo_cambio_usd;
    END IF;
  END IF;

  SELECT 'Pago prov. '
         || COALESCE(NULLIF(pf.folio_proveedor, ''), NULLIF(pf.folio_interno, ''), 's/folio')
         || ' — ' || COALESCE(pr.nombre, pf.proveedor_nombre, 'proveedor')
    INTO v_concepto
  FROM public.proveedor_facturas pf
  LEFT JOIN public.proveedores pr ON pr.id = pf.proveedor_id
  WHERE pf.id = v_pago.proveedor_factura_id;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, pago_proveedor_id,
    conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_pago.organization_id, v_pago.cuenta_bancaria_id, v_pago.fecha_pago,
    COALESCE(v_concepto, 'Pago a proveedor'), COALESCE(v_pago.referencia, ''),
    ROUND(v_cargo, 2), 0, 'pago-' || p_pago_id::text, 'Conciliado', p_pago_id,
    auth.uid(), now(), auth.uid()
  )
  RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO service_role;