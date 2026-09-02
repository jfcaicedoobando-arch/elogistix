-- Fuente canónica. Espejo 1:1 de la migración correspondiente.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- DEFECTO 5 (P1): el flujo de "sugerir embarque" hacía dos inserts
-- independientes (conceptos_costo → proveedor_facturas_conceptos). Si el
-- segundo fallaba quedaba un concepto "Pagado" fantasma sin factura ligada,
-- y reintentar duplicaba el concepto. Esta RPC crea ambos registros en una
-- sola transacción e implementa idempotencia vía client_request_id.

ALTER TABLE public.conceptos_costo
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS conceptos_costo_client_request_id_key
  ON public.conceptos_costo (client_request_id)
  WHERE (client_request_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.crear_concepto_costo_y_vincular_atomico(
  p_factura_id uuid,
  p_embarque_id uuid,
  p_proveedor_id uuid,
  p_proveedor_nombre text,
  p_concepto text,
  p_monto numeric,
  p_moneda text,
  p_folio text,
  p_fecha_emision date,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_org_factura  uuid;
  v_org_embarque uuid;
  v_rol          public.app_role;
  v_concepto_id  uuid;
  v_pfc_id       uuid;
  c_permitidos   public.app_role[] := ARRAY[
    'admin', 'super_admin', 'admin_org', 'contador', 'auxiliar_contable', 'tesorero'
  ]::public.app_role[];
BEGIN
  -- Idempotencia: si ya se procesó este client_request_id, devolvemos lo
  -- creado (nunca fallamos con 23505 en un reintento legítimo).
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_concepto_id
      FROM public.conceptos_costo
     WHERE client_request_id = p_client_request_id
       AND deleted_at IS NULL;
    IF v_concepto_id IS NOT NULL THEN
      SELECT id INTO v_pfc_id
        FROM public.proveedor_facturas_conceptos
       WHERE concepto_costo_id = v_concepto_id
       LIMIT 1;
      RETURN jsonb_build_object(
        'concepto_id', v_concepto_id, 'pfc_id', v_pfc_id, 'reintento', true
      );
    END IF;
  END IF;

  SELECT organization_id INTO v_org_factura
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_org_factura IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_FACTURA_NO_EXISTE: la factura de proveedor no existe o fue eliminada'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT organization_id INTO v_org_embarque
    FROM public.embarques
   WHERE id = p_embarque_id AND deleted_at IS NULL;
  IF v_org_embarque IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: el embarque no existe o fue eliminado'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_org_factura IS DISTINCT FROM v_org_embarque THEN
    RAISE EXCEPTION 'LC_CXP_ORG_MISMATCH: la factura y el embarque pertenecen a organizaciones distintas'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_uid IS NOT NULL AND auth.role() <> 'service_role' THEN
    v_rol := public.rol_efectivo(v_uid, v_org_factura);
    IF NOT (v_rol = ANY (c_permitidos)
            OR public.has_role(v_uid, 'admin'::app_role)
            OR public.has_role(v_uid, 'super_admin'::app_role)
            OR public.has_role(v_uid, 'admin_org'::app_role)
            OR public.has_role(v_uid, 'contador'::app_role)
            OR public.has_role(v_uid, 'auxiliar_contable'::app_role)
            OR public.has_role(v_uid, 'tesorero'::app_role)) THEN
      RAISE EXCEPTION 'LC_CXP_ROL_NO_AUTORIZADO: tu rol no puede vincular costos de factura de proveedor'
        USING ERRCODE = '42501';
    END IF;
    IF v_org_factura IS DISTINCT FROM public.current_user_org_id()
       AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'LC_CXP_ORG_MISMATCH: la factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.conceptos_costo (
      embarque_id, organization_id, proveedor_id, proveedor_nombre, concepto,
      monto, moneda, estado_liquidacion, fecha_pago, referencia_pago,
      client_request_id
    ) VALUES (
      p_embarque_id, v_org_factura, p_proveedor_id, p_proveedor_nombre, p_concepto,
      p_monto, p_moneda::moneda, 'Pagado'::estado_liquidacion, p_fecha_emision, p_folio,
      p_client_request_id
    )
    RETURNING id INTO v_concepto_id;
  EXCEPTION WHEN unique_violation THEN
    -- Carrera con otro submit de la misma llave: reutiliza lo ya creado.
    SELECT id INTO v_concepto_id
      FROM public.conceptos_costo
     WHERE client_request_id = p_client_request_id AND deleted_at IS NULL;
    IF v_concepto_id IS NULL THEN RAISE; END IF;
    SELECT id INTO v_pfc_id
      FROM public.proveedor_facturas_conceptos
     WHERE concepto_costo_id = v_concepto_id
     LIMIT 1;
    RETURN jsonb_build_object(
      'concepto_id', v_concepto_id, 'pfc_id', v_pfc_id, 'reintento', true
    );
  END;

  INSERT INTO public.proveedor_facturas_conceptos (
    proveedor_factura_id, organization_id, concepto_costo_id, descripcion,
    cantidad, monto
  ) VALUES (
    p_factura_id, v_org_factura, v_concepto_id, p_concepto, 1, p_monto
  )
  RETURNING id INTO v_pfc_id;

  RETURN jsonb_build_object(
    'concepto_id', v_concepto_id, 'pfc_id', v_pfc_id, 'reintento', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_concepto_costo_y_vincular_atomico(
  uuid, uuid, uuid, text, text, numeric, text, text, date, uuid
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_concepto_costo_y_vincular_atomico(
  uuid, uuid, uuid, text, text, numeric, text, text, date, uuid
) TO authenticated;