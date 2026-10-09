-- Fuente canónica de public.regenerar_movimiento_pago_proveedor(uuid) (Ola 6 · O6-SCHEMA).
-- 1:1 con la migración Ola 11 · RBD-07 (20260813025053_b5b00098-bfa3-4be4-b352-9a049d381f70).
-- Ola 6 · RG5-1: fail-closed — sin organización resuelta se niega (LC_SIN_ORG).
-- Ola 11 · RBD-07: la rama cross-moneda exige el TC registrado en el pago
--   (LC_PAGO_TC_REQUERIDO); nunca conversión 1:1 silenciosa (clase BL-04).
-- Ola 11 · RBD-04: se restauró el encabezado CREATE OR REPLACE FUNCTION
--   (el archivo canónico empezaba en `RETURNS uuid` y no era SQL válido).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.regenerar_movimiento_pago_proveedor(p_pago_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago         public.pagos_proveedor;
  v_org          uuid;
BEGIN
  SELECT * INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = p_pago_id AND deleted_at IS NULL
  FOR UPDATE;

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

  -- AUD99/121: rechazar antes de reutilizar históricos o generar efectivo.
  IF v_pago.es_ajuste THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede generar ni reutilizar un movimiento bancario'
      USING ERRCODE = 'P0001';
  END IF;

  -- Auditoría 23: el helper reconoce el origen del anticipo antes de crear
  -- nada. El lock del pago serializa reintentos y comparte la ruta idempotente
  -- con el registro/edición normal. Efectivo aplicado válido devuelve NULL.
  IF v_pago.es_anticipo_aplicado
     OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.pago_proveedor_id = p_pago_id AND aa.deleted_at IS NULL) THEN
    RETURN public._movimiento_original_anticipo_aplicado(p_pago_id);
  END IF;
  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: el pago no tiene cuenta bancaria, no hay movimiento que generar'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN public._asegurar_movimiento_pago_proveedor(p_pago_id);
END;
$$;

REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO service_role;
