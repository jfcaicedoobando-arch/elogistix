
-- 1) Nuevo estado 'Sustituida' (sólo agregar si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'Sustituida'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'estado_factura')
  ) THEN
    ALTER TYPE public.estado_factura ADD VALUE 'Sustituida';
  END IF;
END $$;

-- 2) Columnas de cadena de sustitución
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS sustituye_a uuid REFERENCES public.facturas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sustituida_por uuid REFERENCES public.facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_sustituye_a ON public.facturas(sustituye_a) WHERE sustituye_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_sustituida_por ON public.facturas(sustituida_por) WHERE sustituida_por IS NOT NULL;

-- 3) RPC para clonar una factura timbrada en una nueva en Borrador
CREATE OR REPLACE FUNCTION public.duplicar_factura_para_sustitucion(p_factura_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.facturas%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_old FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Validar pertenencia y rol
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_caller
      AND organization_id = v_old.organization_id
      AND role IN ('admin_org','admin','super_admin','contabilidad')
  ) THEN
    RAISE EXCEPTION 'forbidden: requiere rol admin o contabilidad' USING ERRCODE = '42501';
  END IF;

  IF v_old.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'factura_sin_uuid: sólo se puede sustituir un CFDI timbrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_old.sustituida_por IS NOT NULL THEN
    RAISE EXCEPTION 'factura_ya_sustituida' USING ERRCODE = 'P0001';
  END IF;

  IF v_old.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = 'P0001';
  END IF;

  -- Folio nuevo: sufijo -R[n] hasta que no exista
  v_new_numero := v_old.numero || '-R';
  WHILE EXISTS (SELECT 1 FROM public.facturas WHERE organization_id = v_old.organization_id AND numero = v_new_numero) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl,
    snapshot_emision,
    estado, origen,
    sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_old.cliente_id, v_old.cliente_nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, v_old.proforma_id,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE, CURRENT_DATE + COALESCE(v_old.dias_credito, 0), v_old.dias_credito,
    v_old.moneda, v_old.tipo_cambio, v_old.subtotal, v_old.iva, v_old.total,
    v_old.metodo_pago, v_old.forma_pago, v_old.uso_cfdi, v_old.rfc_cliente,
    COALESCE(v_old.notas, '') || E'\n[Sustituye a ' || v_old.numero || ']',
    v_old.referencia_bl,
    v_old.snapshot_emision,
    'Borrador'::estado_factura, v_old.origen,
    v_old.id
  );

  -- Bitácora
  INSERT INTO public.bitacora_actividad (
    organization_id, user_id, tipo, entidad, entidad_id, detalle
  ) VALUES (
    v_old.organization_id, v_caller, 'factura_duplicada_para_sustitucion', 'factura', v_new_id,
    jsonb_build_object('factura_original_id', v_old.id, 'factura_original_uuid', v_old.uuid_fiscal, 'numero_nuevo', v_new_numero)
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicar_factura_para_sustitucion(uuid) TO authenticated;
