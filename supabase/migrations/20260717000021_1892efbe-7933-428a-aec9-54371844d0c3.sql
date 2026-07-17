
-- 1) Add `activa` column to factura_embarques
ALTER TABLE public.factura_embarques
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_factura_embarques_embarque_activa
  ON public.factura_embarques(embarque_id) WHERE activa;

-- 2) RPC: revertir_proforma_al_cancelar_sustitucion
-- Dada una factura recién cancelada/sustituida, libera su proforma si no queda
-- ninguna factura viva apuntando a esa proforma. Idempotente.
CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion(
  p_factura_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proforma_id uuid;
  v_org uuid;
  v_facturas_vivas int;
BEGIN
  SELECT proforma_id, organization_id
    INTO v_proforma_id, v_org
  FROM public.facturas
  WHERE id = p_factura_id;

  IF v_proforma_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ¿Queda alguna factura viva apuntando a esta proforma?
  -- "Viva" = Emitida y sin sustituta viva (heurística: no marcada como Cancelada/Sustituida).
  SELECT count(*) INTO v_facturas_vivas
  FROM public.facturas
  WHERE proforma_id = v_proforma_id
    AND estado NOT IN ('Cancelada','Sustituida','Borrador');

  IF v_facturas_vivas > 0 THEN
    RETURN NULL;
  END IF;

  -- Liberar la proforma sólo si estaba marcada como facturada
  UPDATE public.proformas
     SET estado_proforma = 'pendiente',
         fecha_facturacion = NULL
   WHERE id = v_proforma_id
     AND estado_proforma = 'facturada';

  IF FOUND THEN
    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email,
      accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org,
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'system'),
      'proforma_liberada_por_cancelacion',
      'proformas',
      v_proforma_id,
      '',
      jsonb_build_object('factura_id', p_factura_id)
    );
    RETURN v_proforma_id;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid)
  TO authenticated, service_role;

-- 3) Update duplicar_factura_para_sustitucion to also copy factura_embarques
CREATE OR REPLACE FUNCTION public.duplicar_factura_para_sustitucion(p_factura_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_old public.facturas%ROWTYPE;
  v_sust_estado text;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_caller
      AND organization_id = v_old.organization_id
      AND role IN ('admin_org','admin','super_admin','contador','auxiliar_contable','tesorero')
  ) THEN
    RAISE EXCEPTION 'forbidden: requiere rol admin, contador o tesorero' USING ERRCODE = '42501';
  END IF;

  IF v_old.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'factura_sin_uuid: sólo se puede sustituir un CFDI timbrado' USING ERRCODE = 'P0001';
  END IF;

  IF v_old.sustituida_por IS NOT NULL THEN
    SELECT estado::text INTO v_sust_estado FROM public.facturas WHERE id = v_old.sustituida_por;
    IF v_sust_estado IS NOT NULL AND v_sust_estado NOT IN ('Cancelada','Sustituida') THEN
      RAISE EXCEPTION 'factura_ya_sustituida' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_old.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = 'P0001';
  END IF;

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
    NULL,
    'Borrador', v_old.origen,
    v_old.id
  );

  UPDATE public.facturas SET sustituida_por = v_new_id WHERE id = v_old.id;

  INSERT INTO public.conceptos_factura (
    factura_id, organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  )
  SELECT
    v_new_id, v_old.organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  FROM public.conceptos_factura
  WHERE factura_id = v_old.id
    AND deleted_at IS NULL;

  -- Copiar los vínculos con embarques (tabla puente) al borrador sustituto.
  -- La original queda con activa=false al cancelarse; la nueva nace activa.
  INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
  SELECT v_new_id, embarque_id, organization_id, true
  FROM public.factura_embarques
  WHERE factura_id = v_old.id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id,
    v_caller,
    COALESCE((SELECT email FROM auth.users WHERE id = v_caller), ''),
    'factura_duplicada_para_sustitucion',
    'facturacion',
    v_new_id,
    COALESCE(v_new_numero, ''),
    jsonb_build_object('factura_original_id', v_old.id, 'factura_original_uuid', v_old.uuid_fiscal, 'numero_nuevo', v_new_numero)
  );

  RETURN v_new_id;
END;
$function$;

-- 4) Backfill: sincronizar factura_embarques.activa según estado actual de facturas
UPDATE public.factura_embarques fe
   SET activa = false
  FROM public.facturas f
 WHERE fe.factura_id = f.id
   AND f.estado IN ('Cancelada','Sustituida')
   AND fe.activa = true;

-- 5) Backfill: liberar proformas cuyas facturas ya están todas canceladas/sustituidas
DO $$
DECLARE
  v_liberadas int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS proforma_id
    FROM public.proformas p
    WHERE p.estado_proforma = 'facturada'
      AND NOT EXISTS (
        SELECT 1 FROM public.facturas f
        WHERE f.proforma_id = p.id
          AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
      )
      AND EXISTS (
        SELECT 1 FROM public.facturas f2
        WHERE f2.proforma_id = p.id
      )
  LOOP
    UPDATE public.proformas
       SET estado_proforma = 'pendiente',
           fecha_facturacion = NULL
     WHERE id = r.proforma_id;
    v_liberadas := v_liberadas + 1;
  END LOOP;
  RAISE NOTICE 'Proformas liberadas por backfill: %', v_liberadas;
END $$;
