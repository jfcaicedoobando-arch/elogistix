-- Ola 12 · Refacturación a otro receptor — Etapa 1 (base de datos)

CREATE TABLE IF NOT EXISTS public.refacturaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  factura_original_id uuid NOT NULL REFERENCES public.facturas(id),
  factura_nueva_id uuid REFERENCES public.facturas(id),
  cliente_origen_id uuid,
  cliente_destino_id uuid NOT NULL,
  ruta_fiscal text NOT NULL DEFAULT '02',
  motivo text NOT NULL DEFAULT '',
  embarque_id uuid,
  pago_original_id uuid,
  pago_nuevo_id uuid,
  estado text NOT NULL DEFAULT 'abierto',
  paso_actual smallint NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cerrado_at timestamptz,
  CONSTRAINT refacturaciones_ruta_chk CHECK (ruta_fiscal IN ('01','02')),
  CONSTRAINT refacturaciones_estado_chk CHECK (estado IN ('abierto','completado','cancelado')),
  CONSTRAINT refacturaciones_paso_chk CHECK (paso_actual BETWEEN 1 AND 5)
);

GRANT SELECT, INSERT, UPDATE ON public.refacturaciones TO authenticated;
GRANT ALL ON public.refacturaciones TO service_role;

ALTER TABLE public.refacturaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read refacturaciones" ON public.refacturaciones;
CREATE POLICY "Tenant read refacturaciones"
ON public.refacturaciones FOR SELECT TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Fiscal write refacturaciones" ON public.refacturaciones;
CREATE POLICY "Fiscal write refacturaciones"
ON public.refacturaciones FOR INSERT TO authenticated
WITH CHECK (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  AND public.es_escritor_financiero((SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Fiscal update refacturaciones" ON public.refacturaciones;
CREATE POLICY "Fiscal update refacturaciones"
ON public.refacturaciones FOR UPDATE TO authenticated
USING (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  AND public.es_escritor_financiero((SELECT auth.uid()))
);

CREATE INDEX IF NOT EXISTS idx_refacturaciones_org_estado
  ON public.refacturaciones (organization_id, estado);
CREATE INDEX IF NOT EXISTS idx_refacturaciones_original
  ON public.refacturaciones (factura_original_id);
CREATE INDEX IF NOT EXISTS idx_refacturaciones_nueva
  ON public.refacturaciones (factura_nueva_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_refacturaciones_original_abierta
  ON public.refacturaciones (factura_original_id)
  WHERE estado = 'abierto';

DROP TRIGGER IF EXISTS update_refacturaciones_updated_at ON public.refacturaciones;
CREATE TRIGGER update_refacturaciones_updated_at
BEFORE UPDATE ON public.refacturaciones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ordenante real del depósito (el cliente pagó desde otra empresa).
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS ordenante_distinto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordenante_nombre text,
  ADD COLUMN IF NOT EXISTS ordenante_rfc text,
  ADD COLUMN IF NOT EXISTS refacturacion_id uuid;

-- Guard común: sólo administradores del tenant y contadores operan casos.
CREATE OR REPLACE FUNCTION public._assert_refacturador(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  IF public.has_role(v_uid, 'super_admin'::app_role) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = v_uid
      AND organization_id = p_org
      AND role IN ('admin_org','admin','contador')
  ) THEN
    RAISE EXCEPTION 'LC_REFACT_FORBIDDEN: se requiere rol de administrador de la organización o contador'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_refacturador(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_refacturador(uuid) TO authenticated, service_role;

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

CREATE OR REPLACE FUNCTION public.refacturacion_set_paso(p_caso_id uuid, p_paso smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.refacturaciones WHERE id = p_caso_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_org);
  IF p_paso < 1 OR p_paso > 5 THEN
    RAISE EXCEPTION 'LC_REFACT_PASO: paso fuera de rango' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.refacturaciones
     SET paso_actual = GREATEST(paso_actual, p_paso)
   WHERE id = p_caso_id AND estado = 'abierto';
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturacion_set_paso(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refacturacion_set_paso(uuid, smallint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cerrar_caso_refacturacion(p_caso_id uuid, p_cancelar boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  UPDATE public.refacturaciones
     SET estado = CASE WHEN p_cancelar THEN 'cancelado' ELSE 'completado' END,
         paso_actual = CASE WHEN p_cancelar THEN paso_actual ELSE 5 END,
         cerrado_at = now()
   WHERE id = p_caso_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_c.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    CASE WHEN p_cancelar THEN 'refacturacion_cancelada' ELSE 'refacturacion_completada' END,
    'facturacion', v_c.factura_original_id, '',
    jsonb_build_object('caso_id', p_caso_id, 'factura_nueva_id', v_c.factura_nueva_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.duplicar_factura_para_refacturacion(p_caso_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_cli public.clientes%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
  v_estado_nueva text;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  IF v_c.factura_nueva_id IS NOT NULL THEN
    SELECT estado::text INTO v_estado_nueva FROM public.facturas WHERE id = v_c.factura_nueva_id;
    IF v_estado_nueva IS NOT NULL AND v_estado_nueva <> 'Cancelada' THEN
      RETURN v_c.factura_nueva_id;
    END IF;
  END IF;

  SELECT * INTO v_old FROM public.facturas WHERE id = v_c.factura_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cli FROM public.clientes WHERE id = v_c.cliente_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe' USING ERRCODE = 'P0002';
  END IF;

  v_new_numero := v_old.numero || '-RF';
  WHILE EXISTS (
    SELECT 1 FROM public.facturas
    WHERE organization_id = v_old.organization_id AND numero = v_new_numero
  ) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl, snapshot_emision, estado, origen, sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_cli.id, v_cli.nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, v_old.proforma_id,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE,
    CURRENT_DATE + COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    v_old.moneda, v_old.tipo_cambio, v_old.subtotal, v_old.iva, v_old.total,
    COALESCE(v_cli.metodo_pago_default, v_old.metodo_pago),
    COALESCE(v_cli.forma_pago_default, v_old.forma_pago),
    COALESCE(v_cli.uso_cfdi_default, v_old.uso_cfdi),
    v_cli.rfc,
    COALESCE(v_old.notas, '') || E'\n[Refacturación de ' || v_old.numero || ' a ' || v_cli.nombre || ']',
    v_old.referencia_bl, NULL, 'Borrador', v_old.origen,
    CASE WHEN v_c.ruta_fiscal = '01' THEN v_old.id ELSE NULL END
  );

  IF v_c.ruta_fiscal = '01' THEN
    UPDATE public.facturas SET sustituida_por = v_new_id WHERE id = v_old.id;
  END IF;

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
  WHERE factura_id = v_old.id AND deleted_at IS NULL;

  INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
  SELECT v_new_id, embarque_id, organization_id, true
  FROM public.factura_embarques
  WHERE factura_id = v_old.id
  ON CONFLICT DO NOTHING;

  UPDATE public.refacturaciones
     SET factura_nueva_id = v_new_id, paso_actual = GREATEST(paso_actual, 3)
   WHERE id = p_caso_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_borrador_creado', 'facturacion', v_new_id, COALESCE(v_new_numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'factura_original_id', v_old.id,
                       'cliente_destino_id', v_cli.id, 'rfc_destino', v_cli.rfc,
                       'ruta_fiscal', v_c.ruta_fiscal)
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reasignar_pago_factura(
  p_pago_id uuid,
  p_factura_destino_id uuid,
  p_caso_id uuid DEFAULT NULL,
  p_ordenante_nombre text DEFAULT NULL,
  p_ordenante_rfc text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p public.pagos_factura%ROWTYPE;
  v_dest public.facturas%ROWTYPE;
  v_new_id uuid;
  v_saldo numeric;
  v_pagado numeric;
  v_ncs numeric;
BEGIN
  SELECT * INTO v_p FROM public.pagos_factura WHERE id = p_pago_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_PAGO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_p.organization_id);

  IF v_p.uuid_rep IS NOT NULL AND v_p.rep_cancelado_en IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_REP_VIVO: cancela el complemento de pago (REP) antes de reasignar el pago'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dest FROM public.facturas WHERE id = p_factura_destino_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  IF v_dest.organization_id <> v_p.organization_id THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_OTRA_ORG' USING ERRCODE = '42501';
  END IF;
  IF v_dest.uuid_fiscal IS NULL OR v_dest.estado IN ('Borrador','Cancelada','Sustituida') THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_TIMBRADA: la factura destino debe estar timbrada y vigente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_dest.moneda <> v_p.moneda THEN
    RAISE EXCEPTION 'LC_REFACT_MONEDA: el pago está en % y la factura destino en %', v_p.moneda, v_dest.moneda
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM public.pagos_factura
  WHERE factura_id = p_factura_destino_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_destino_id AND deleted_at IS NULL AND estado = 'Aplicada';
  v_saldo := COALESCE(v_dest.total, 0) - v_pagado - v_ncs;

  IF ROUND(v_p.monto_aplicado_factura, 2) > ROUND(v_saldo, 2) + 0.01 THEN
    RAISE EXCEPTION 'LC_REFACT_SOBREPAGO: el pago (%) excede el saldo de la factura destino (%)',
      v_p.monto_aplicado_factura, v_saldo USING ERRCODE = 'P0001';
  END IF;

  -- 1) Baja lógica del pago original (el trigger de REP vivo ya se validó arriba).
  UPDATE public.pagos_factura
     SET deleted_at = now(), deleted_by = auth.uid(),
         notas = COALESCE(notas, '') || ' [Reasignado a factura ' || COALESCE(v_dest.numero, '') || ']',
         refacturacion_id = COALESCE(p_caso_id, refacturacion_id)
   WHERE id = p_pago_id;

  -- 2) Alta del pago equivalente en la factura destino.
  INSERT INTO public.pagos_factura (
    factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, referencia, notas,
    diferencia_cambiaria_mxn, embarque_id, cuenta_bancaria_id, created_by,
    ordenante_distinto, ordenante_nombre, ordenante_rfc, refacturacion_id
  ) VALUES (
    p_factura_destino_id, v_p.organization_id, v_p.fecha_pago, v_p.monto, v_p.moneda, v_p.tipo_cambio,
    v_p.monto_aplicado_factura, v_p.forma_pago, v_p.referencia,
    COALESCE(v_p.notas, '') || ' [Reasignado desde pago ' || p_pago_id::text || ']',
    COALESCE(v_p.diferencia_cambiaria_mxn, 0), v_dest.embarque_id, v_p.cuenta_bancaria_id, auth.uid(),
    (p_ordenante_nombre IS NOT NULL AND btrim(p_ordenante_nombre) <> ''),
    NULLIF(btrim(COALESCE(p_ordenante_nombre, '')), ''),
    NULLIF(btrim(COALESCE(p_ordenante_rfc, '')), ''),
    p_caso_id
  )
  RETURNING id INTO v_new_id;

  -- 3) Traslado del movimiento bancario (queda conciliado con el pago nuevo).
  UPDATE public.bbva_movimientos
     SET pago_factura_id = v_new_id,
         estado_conciliacion = 'Conciliado',
         conciliado_por = auth.uid(),
         conciliado_at = now()
   WHERE pago_factura_id = p_pago_id;

  IF p_caso_id IS NOT NULL THEN
    UPDATE public.refacturaciones
       SET pago_original_id = COALESCE(pago_original_id, p_pago_id),
           pago_nuevo_id = v_new_id,
           paso_actual = 5
     WHERE id = p_caso_id;
  END IF;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_p.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_pago_reasignado', 'facturacion', p_factura_destino_id,
    COALESCE(v_dest.numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'pago_original_id', p_pago_id,
                       'pago_nuevo_id', v_new_id, 'monto', v_p.monto, 'moneda', v_p.moneda,
                       'ordenante_nombre', NULLIF(btrim(COALESCE(p_ordenante_nombre, '')), ''))
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) TO authenticated, service_role;