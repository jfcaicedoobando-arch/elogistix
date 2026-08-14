CREATE OR REPLACE FUNCTION public.abrir_caso_refacturacion(
  p_factura_id uuid,
  p_cliente_destino_id uuid,
  p_ruta_fiscal text DEFAULT '02',
  p_motivo text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_f public.facturas%ROWTYPE;
  v_dest_org uuid;
  v_id uuid;
BEGIN
  IF p_ruta_fiscal NOT IN ('01','02') THEN
    RAISE EXCEPTION 'LC_REFACT_RUTA: ruta fiscal inválida (01 o 02)' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_f.organization_id);

  IF v_f.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_TIMBRADA: la factura original no está timbrada'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_f.estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_VIVA: la factura está en estado %', v_f.estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT organization_id INTO v_dest_org
  FROM public.clientes WHERE id = p_cliente_destino_id AND deleted_at IS NULL;
  IF v_dest_org IS NULL OR v_dest_org <> v_f.organization_id THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe en esta organización'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_cliente_destino_id = v_f.cliente_id THEN
    RAISE EXCEPTION 'LC_REFACT_MISMO_CLIENTE: el cliente destino es el mismo de la factura'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._assert_receptor_fiscal_valido(p_cliente_destino_id);

  IF EXISTS (
    SELECT 1 FROM public.refacturaciones
    WHERE factura_original_id = p_factura_id AND estado = 'abierto'
  ) THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_ABIERTO: ya existe un caso de refacturación abierto para esta factura'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.refacturaciones (
    organization_id, factura_original_id, cliente_origen_id, cliente_destino_id,
    ruta_fiscal, motivo, embarque_id, pago_original_id, created_by
  ) VALUES (
    v_f.organization_id, p_factura_id, v_f.cliente_id, p_cliente_destino_id,
    p_ruta_fiscal, COALESCE(p_motivo, ''), v_f.embarque_id,
    (SELECT id FROM public.pagos_factura
      WHERE factura_id = p_factura_id AND deleted_at IS NULL
      ORDER BY fecha_pago DESC, created_at DESC LIMIT 1),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_f.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_abierta', 'facturacion', p_factura_id, COALESCE(v_f.numero, ''),
    jsonb_build_object('caso_id', v_id, 'ruta_fiscal', p_ruta_fiscal,
                       'cliente_destino_id', p_cliente_destino_id, 'motivo', COALESCE(p_motivo, ''))
  );

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.abrir_caso_refacturacion(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abrir_caso_refacturacion(uuid, uuid, text, text) TO authenticated, service_role;

-- 4) Duplicado: valida receptor y copia también retenciones.
