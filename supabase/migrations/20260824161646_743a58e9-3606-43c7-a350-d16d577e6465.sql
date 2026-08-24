-- ============================================================================
-- FIX3 · Consistencia de BD (8 hallazgos validados contra la base real).
--   M-4  pagos: guard de fecha extendido a UPDATE + fecha previa a emisión.
--   P2   helpers financieros SECURITY DEFINER: revocar a `authenticated`.
--   drift portal_obtener_proforma_por_token: restaurar rate limit + VOLATILE.
--   P3   sync_cotizacion_embarque_link: validar misma organización.
--   P3   NC cliente: recalcular comisiones también ante deleted_at.
--   M-5  updated_at (columna + trigger) en 10 tablas objetivo.
--   M-1  crm_propagar_conversion_cliente: ERRCODE 42501 en rechazos de permiso.
--   BUG-18 buzón CxP: bandera metadatos_verificados sellada sólo server-side.
-- ============================================================================

-- ---------------------------------------------------------------- 1) M-4 pagos
CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_cancel text;
  v_total numeric;
  v_fecha_emision date;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_saldo_disponible_previo numeric;
  v_saldo_post numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.fecha_pago IS NOT NULL AND NEW.fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del cobro no puede ser futura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('fecha_pago', NEW.fecha_pago)::text;
  END IF;

  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0), COALESCE(cancellation_status, 'none'),
         fecha_emision
    INTO v_estado, v_total, v_cancel, v_fecha_emision
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  IF v_cancel IN ('pending','verifying') THEN
    RAISE EXCEPTION 'LC_FACTURA_EN_CANCELACION: la factura tiene una cancelación en trámite ante el SAT y no admite cobros'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('cancellation_status', v_cancel)::text;
  END IF;

  IF NEW.fecha_pago IS NOT NULL
     AND v_fecha_emision IS NOT NULL
     AND NEW.fecha_pago < v_fecha_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del cobro no puede ser anterior a la emisión de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'fecha_pago', NEW.fecha_pago,
              'fecha_emision', v_fecha_emision
            )::text;
  END IF;

  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_ncs := public.nc_aplicadas_en_moneda_factura(NEW.factura_id);

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_disponible_previo,
              'monto_intentado', NEW.monto_aplicado_factura,
              'notas_credito_aplicadas', v_ncs
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM anon;

-- --------------------------------------------------- 2) P2 helpers financieros
REVOKE EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.comision_embarques_de_factura(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comision_embarques_de_factura(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.comision_embarques_de_factura(uuid) TO service_role;

-- ----------------------------------------- 3) drift rate limit portal proforma
CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_conceptos jsonb;
  v_estado_link text;
  v_rl jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:portal_obtener_proforma_por_token:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 30
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  IF p_token IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_proforma FROM public.proformas WHERE token_publico = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','token_invalido'); END IF;

  IF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    v_estado_link := 'expirado';
  ELSIF v_proforma.estado_cliente <> 'pendiente' THEN
    v_estado_link := 'respondida';
  ELSE
    v_estado_link := 'activo';
  END IF;

  IF v_estado_link <> 'activo' THEN
    RETURN jsonb_build_object(
      'estado_link', v_estado_link,
      'proforma', jsonb_build_object(
        'id', v_proforma.id,
        'numero', v_proforma.numero
      ),
      'conceptos', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pcc.id,
    'descripcion', pcc.descripcion,
    'cantidad', pcc.cantidad,
    'precio_unitario', pcc.precio_unitario,
    'importe', pcc.total,
    'moneda', pcc.moneda
  ) ORDER BY pcc.created_at), '[]'::jsonb)
    INTO v_conceptos
    FROM public.proforma_conceptos_consolidados pcc
   WHERE pcc.proforma_id = v_proforma.id;

  RETURN jsonb_build_object(
    'estado_link', v_estado_link,
    'proforma', jsonb_build_object(
      'id', v_proforma.id,
      'numero', v_proforma.numero,
      'cliente_nombre', v_proforma.cliente_nombre,
      'expediente', v_proforma.expediente,
      'moneda', v_proforma.moneda,
      'subtotal', v_proforma.subtotal,
      'iva', v_proforma.iva,
      'total', v_proforma.total,
      'estado_cliente', v_proforma.estado_cliente,
      'aceptada_at', v_proforma.aceptada_at,
      'rechazada_at', v_proforma.rechazada_at,
      'motivo_rechazo', v_proforma.motivo_rechazo,
      'created_at', v_proforma.created_at,
      'token_expira_at', v_proforma.token_expira_at
    ),
    'conceptos', v_conceptos
  );
END $function$;

REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated;

-- ------------------------------------------- 4) P3 vínculo cotización/embarque
CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = NEW.id
       AND organization_id = NEW.organization_id;
    RETURN NEW;
  END IF;

  IF NEW.cotizacion_id IS NOT NULL THEN
    PERFORM 1
      FROM public.cotizaciones
     WHERE id = NEW.cotizacion_id
       AND organization_id = NEW.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_COTIZACION_OTRA_ORG: la cotización no existe o pertenece a otra organización'
        USING ERRCODE = '23514',
              HINT    = json_build_object(
                'cotizacion_id', NEW.cotizacion_id,
                'organization_id', NEW.organization_id
              )::text;
    END IF;

    UPDATE public.cotizaciones
    SET
      embarque_id = NEW.id,
      estado = CASE
        WHEN estado = 'Aceptada'::estado_cotizacion
             AND NEW.estado <> 'Borrador'::estado_embarque
        THEN 'En operación'::estado_cotizacion
        ELSE estado
      END,
      updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND organization_id = NEW.organization_id
      AND (
        embarque_id IS DISTINCT FROM NEW.id
        OR (estado = 'Aceptada'::estado_cotizacion AND NEW.estado <> 'Borrador'::estado_embarque)
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_cotizacion_embarque_link ON public.embarques;
CREATE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id, deleted_at ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.sync_cotizacion_embarque_link();

-- ---------------------------------- 5) P3 comisiones ante NC borrada/cancelada
CREATE OR REPLACE FUNCTION public._nc_cliente_recalcular_comisiones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD;
  v_contaba boolean;
  v_cuenta boolean;
BEGIN
  v_cuenta  := (NEW.estado::text = 'Aplicada' AND NEW.deleted_at IS NULL);
  v_contaba := (TG_OP = 'UPDATE'
                AND OLD.estado::text = 'Aplicada'
                AND OLD.deleted_at IS NULL);

  IF NOT v_cuenta AND NOT v_contaba THEN
    RETURN NEW;
  END IF;

  IF v_cuenta AND v_contaba
     AND COALESCE(OLD.monto, 0) = COALESCE(NEW.monto, 0) THEN
    RETURN NEW;
  END IF;

  FOR v_pago IN
    SELECT pf.id, pf.organization_id,
           EXISTS (
             SELECT 1 FROM public.comisiones_devengadas cd
              WHERE cd.pago_factura_id = pf.id
                AND cd.estado = 'Liquidada'
                AND cd.deleted_at IS NULL
           ) AS ya_liquidada
      FROM public.pagos_factura pf
     WHERE pf.factura_id = NEW.factura_id
       AND pf.deleted_at IS NULL
  LOOP
    IF v_pago.ya_liquidada THEN
      PERFORM public.registrar_comision_pendiente(
        v_pago.organization_id, v_pago.id, 'ajuste_nc_liquidada',
        CASE WHEN v_cuenta
          THEN 'Nota de crédito aplicada sobre comisión ya liquidada: descontar en la siguiente liquidación'
          ELSE 'Nota de crédito cancelada o en papelera sobre comisión ya liquidada: recalcular el ajuste en la siguiente liquidación'
        END,
        '', '');
    ELSE
      BEGIN
        PERFORM public.calcular_comision_pago(v_pago.id);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.registrar_comision_pendiente(
          v_pago.organization_id, v_pago.id, 'ajuste_nc',
          'No se pudo recalcular la comisión tras la nota de crédito',
          SQLSTATE, SQLERRM);
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nc_cliente_recalcular_comisiones ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_cliente_recalcular_comisiones
AFTER INSERT OR UPDATE OF estado, monto, deleted_at ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public._nc_cliente_recalcular_comisiones();

-- ------------------------------------------- 6) M-5 updated_at (10 tablas)
ALTER TABLE public.conceptos_venta                  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.conceptos_costo                  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.conceptos_factura                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.contactos_cliente                ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.documentos_embarque              ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.eventos_embarque                 ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.notas_embarque                   ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.proforma_conceptos_consolidados  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.proveedor_facturas_conceptos     ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.crm_notificaciones               ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS update_conceptos_venta_updated_at ON public.conceptos_venta;
CREATE TRIGGER update_conceptos_venta_updated_at
  BEFORE UPDATE ON public.conceptos_venta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conceptos_costo_updated_at ON public.conceptos_costo;
CREATE TRIGGER update_conceptos_costo_updated_at
  BEFORE UPDATE ON public.conceptos_costo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conceptos_factura_updated_at ON public.conceptos_factura;
CREATE TRIGGER update_conceptos_factura_updated_at
  BEFORE UPDATE ON public.conceptos_factura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contactos_cliente_updated_at ON public.contactos_cliente;
CREATE TRIGGER update_contactos_cliente_updated_at
  BEFORE UPDATE ON public.contactos_cliente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_documentos_embarque_updated_at ON public.documentos_embarque;
CREATE TRIGGER update_documentos_embarque_updated_at
  BEFORE UPDATE ON public.documentos_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_eventos_embarque_updated_at ON public.eventos_embarque;
CREATE TRIGGER update_eventos_embarque_updated_at
  BEFORE UPDATE ON public.eventos_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notas_embarque_updated_at ON public.notas_embarque;
CREATE TRIGGER update_notas_embarque_updated_at
  BEFORE UPDATE ON public.notas_embarque
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_proforma_conceptos_consolidados_updated_at ON public.proforma_conceptos_consolidados;
CREATE TRIGGER update_proforma_conceptos_consolidados_updated_at
  BEFORE UPDATE ON public.proforma_conceptos_consolidados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_proveedor_facturas_conceptos_updated_at ON public.proveedor_facturas_conceptos;
CREATE TRIGGER update_proveedor_facturas_conceptos_updated_at
  BEFORE UPDATE ON public.proveedor_facturas_conceptos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_notificaciones_updated_at ON public.crm_notificaciones;
CREATE TRIGGER update_crm_notificaciones_updated_at
  BEFORE UPDATE ON public.crm_notificaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------- 7) M-1 CRM ERRCODE 42501
CREATE OR REPLACE FUNCTION public.crm_propagar_conversion_cliente(p_oportunidad_id uuid, p_cliente_id uuid, p_cliente_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_op public.crm_oportunidades;
  v_lead_id uuid;
  v_cliente_org uuid;
  v_uid uuid := auth.uid();
  v_gerencial boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO' USING ERRCODE = '42501';
  END IF;

  IF p_oportunidad_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_PARAMETROS_INVALIDOS';
  END IF;

  v_gerencial := public.has_any_role_efectivo(v_uid,
    ARRAY['admin','admin_org','super_admin','gerente_comercial','gerente_operaciones']::app_role[]);

  IF NOT v_gerencial
     AND NOT public.has_role(v_uid, 'vendedor'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_op
  FROM public.crm_oportunidades
  WHERE id = p_oportunidad_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_op.id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_NO_ENCONTRADA';
  END IF;

  IF public.is_org_member(v_op.organization_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;

  IF NOT v_gerencial AND COALESCE(v_op.vendedor_id, v_op.created_by) IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad está asignada a otra persona'
      USING ERRCODE = '42501';
  END IF;

  IF v_op.cliente_id IS NOT NULL AND v_op.cliente_id <> p_cliente_id THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_YA_CONVERTIDA: la oportunidad ya está ligada a otro cliente';
  END IF;

  SELECT organization_id INTO v_cliente_org
  FROM public.clientes
  WHERE id = p_cliente_id AND deleted_at IS NULL;

  IF v_cliente_org IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_NO_ENCONTRADO';
  END IF;
  IF v_cliente_org <> v_op.organization_id THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;

  UPDATE public.crm_oportunidades
     SET cliente_id = p_cliente_id,
         cliente_nombre = COALESCE(NULLIF(p_cliente_nombre, ''), cliente_nombre),
         updated_at = now()
   WHERE id = p_oportunidad_id;

  v_lead_id := v_op.lead_id;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.crm_leads
       SET estado = 'Convertido'::public.crm_lead_estado,
           cliente_convertido_id = p_cliente_id,
           oportunidad_convertida_id = p_oportunidad_id,
           updated_at = now()
     WHERE id = v_lead_id
       AND organization_id = v_op.organization_id
       AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'oportunidad_id', p_oportunidad_id,
    'cliente_id', p_cliente_id,
    'lead_id', v_lead_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) TO authenticated, service_role;

-- --------------------------------------- 8) BUG-18 metadatos fiscales sellados
ALTER TABLE public.embarque_facturas_entrantes
  ADD COLUMN IF NOT EXISTS metadatos_verificados boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._entrante_meta_cliente_no_verificada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.entrante_xml_verificado', true) IS DISTINCT FROM 'on' THEN
    NEW.metadatos_verificados := false;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_entrante_meta_no_verificada ON public.embarque_facturas_entrantes;
CREATE TRIGGER trg_entrante_meta_no_verificada
BEFORE INSERT OR UPDATE ON public.embarque_facturas_entrantes
FOR EACH ROW EXECUTE FUNCTION public._entrante_meta_cliente_no_verificada();

CREATE OR REPLACE FUNCTION public.adjuntar_xml_entrante_verificado(
  p_documento_id uuid,
  p_actor uuid,
  p_xml_path text,
  p_xml_nombre text,
  p_xml_hash text,
  p_uuid_fiscal text DEFAULT NULL,
  p_rfc_emisor text DEFAULT NULL,
  p_folio_serie text DEFAULT NULL,
  p_fecha_emision date DEFAULT NULL,
  p_total_detectado numeric DEFAULT NULL,
  p_moneda_detectada text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_rol public.app_role;
  c_permitidos public.app_role[] := ARRAY[
    'operador', 'coordinador_logistico', 'gerente_operaciones',
    'contador', 'auxiliar_contable', 'admin', 'admin_org', 'super_admin'
  ]::public.app_role[];
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: actor requerido';
  END IF;

  SELECT organization_id INTO v_org
    FROM public.embarque_facturas_entrantes
   WHERE id = p_documento_id
     AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no existe o fue eliminado';
  END IF;

  IF NOT public.has_role(p_actor, 'super_admin'::public.app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
        WHERE user_id = p_actor AND organization_id = v_org
     ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: el usuario no pertenece a la organización del documento';
  END IF;

  v_rol := public.rol_efectivo(p_actor, v_org);
  IF NOT (v_rol = ANY (c_permitidos)
          OR public.has_role(p_actor, 'operador'::public.app_role)
          OR public.has_role(p_actor, 'coordinador_logistico'::public.app_role)
          OR public.has_role(p_actor, 'gerente_operaciones'::public.app_role)
          OR public.has_role(p_actor, 'contador'::public.app_role)
          OR public.has_role(p_actor, 'auxiliar_contable'::public.app_role)
          OR public.has_role(p_actor, 'admin'::public.app_role)
          OR public.has_role(p_actor, 'admin_org'::public.app_role)
          OR public.has_role(p_actor, 'super_admin'::public.app_role)) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin permiso para adjuntar XML al buzón'
      USING ERRCODE = '42501';
  END IF;

  IF p_uuid_fiscal IS NOT NULL
     AND p_uuid_fiscal !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'LC_XML_UUID_INVALIDO: el UUID fiscal no tiene formato UUID válido'
      USING ERRCODE = '23514';
  END IF;
  IF p_total_detectado IS NOT NULL AND p_total_detectado <= 0 THEN
    RAISE EXCEPTION 'LC_XML_TOTAL_INVALIDO: el total detectado debe ser mayor a cero'
      USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.entrante_xml_verificado', 'on', true);

  UPDATE public.embarque_facturas_entrantes
     SET xml_path = p_xml_path,
         xml_nombre = p_xml_nombre,
         xml_hash = p_xml_hash,
         uuid_fiscal = p_uuid_fiscal,
         rfc_emisor = p_rfc_emisor,
         folio_serie = p_folio_serie,
         fecha_emision = p_fecha_emision,
         total_detectado = p_total_detectado,
         moneda_detectada = p_moneda_detectada,
         metadatos_verificados = true
   WHERE id = p_documento_id
     AND organization_id = v_org
     AND estado = 'por_capturar'
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_INVALIDO: el documento no existe, ya fue capturado o pertenece a otra organización';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text) FROM authenticated;