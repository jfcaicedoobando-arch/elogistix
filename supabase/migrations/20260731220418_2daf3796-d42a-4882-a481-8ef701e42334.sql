-- ============================================================================
-- Estado "Por liquidar": cierre operativo separado del cierre financiero.
-- ============================================================================

-- 1) Documentos requeridos: mismo requisito que EIR/Cerrado.
CREATE OR REPLACE FUNCTION public._docs_requeridos_por_estado(p_modo text, p_estado text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_estado
    WHEN 'Confirmado'  THEN ARRAY[]::text[]
    WHEN 'En Tránsito' THEN ARRAY[]::text[]
    WHEN 'En Aduana' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Llegada' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Arribo' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'En Proceso' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Entregado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'EIR' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Por liquidar' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    WHEN 'Cerrado' THEN
      CASE p_modo
        WHEN 'Aéreo'     THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
        WHEN 'Terrestre' THEN ARRAY['Factura','Lista de Empaque','Carta Porte']
        ELSE                  ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
      END
    ELSE ARRAY[]::text[]
  END;
$function$;

-- 2) Máquina de estados: EIR -> Por liquidar -> Cerrado.
CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(p_actual estado_embarque, p_nuevo estado_embarque)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    WHEN 'Borrador'     THEN p_nuevo IN ('Confirmado')
    WHEN 'Cotización'   THEN p_nuevo IN ('Confirmado','Borrador')
    WHEN 'Confirmado'   THEN p_nuevo IN ('En Tránsito','Borrador')
    WHEN 'En Tránsito'  THEN p_nuevo IN ('Arribo','En Proceso')
    WHEN 'Arribo'       THEN p_nuevo IN ('En Aduana','En Tránsito')
    WHEN 'En Aduana'    THEN p_nuevo IN ('Entregado','Arribo')
    WHEN 'Llegada'      THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Entregado'    THEN p_nuevo IN ('EIR','En Aduana','Cerrado')
    -- Cierre operativo: EIR desemboca en "Por liquidar". Se conserva el salto
    -- directo a Cerrado para embarques que ya están liquidados.
    WHEN 'EIR'          THEN p_nuevo IN ('Por liquidar','Cerrado','Entregado')
    WHEN 'Por liquidar' THEN p_nuevo IN ('Cerrado','EIR')
    -- Reapertura: un embarque cerrado regresa al cierre administrativo.
    WHEN 'Cerrado'      THEN p_nuevo IN ('Por liquidar','EIR')
    WHEN 'En Proceso'   THEN p_nuevo IN ('En Tránsito','Arribo','En Aduana')
    WHEN 'Cancelado'    THEN false
    ELSE false
  END;
END;
$function$;

-- 3) ¿Terminó la parte operativa? (documentos + fechas de contenedores)
CREATE OR REPLACE FUNCTION public.embarque_operativo_completo(p_embarque_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_docs_faltantes int;
  v_cont_sin_fechas int;
BEGIN
  IF p_embarque_id IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_docs_faltantes
    FROM documentos_embarque de
   WHERE de.embarque_id = p_embarque_id
     AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo = '')
     AND de.estado <> 'No aplica';

  SELECT COUNT(*) INTO v_cont_sin_fechas
    FROM embarque_contenedores ec
   WHERE ec.embarque_id = p_embarque_id
     AND ec.deleted_at IS NULL
     AND (ec.fecha_descarga IS NULL OR ec.fecha_devolucion IS NULL);

  RETURN v_docs_faltantes = 0 AND v_cont_sin_fechas = 0;
END;
$function$;

-- 4) Promoción automática EIR -> Por liquidar.
CREATE OR REPLACE FUNCTION public.promover_embarque_por_liquidar(p_embarque_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_org_id uuid;
BEGIN
  SELECT estado::text, organization_id INTO v_estado, v_org_id
    FROM embarques WHERE id = p_embarque_id;
  IF v_estado IS DISTINCT FROM 'EIR' THEN RETURN false; END IF;
  IF NOT public.embarque_operativo_completo(p_embarque_id) THEN RETURN false; END IF;

  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id,
          'Operación terminada: el embarque pasó automáticamente a "Por liquidar". Falta cobrar al cliente y/o pagar al proveedor.',
          'cambio_estado'::tipo_nota, 'sistema', v_org_id);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public._trg_promover_por_liquidar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_embarque_id uuid := COALESCE(NEW.embarque_id, OLD.embarque_id);
BEGIN
  BEGIN
    PERFORM public.promover_embarque_por_liquidar(v_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nunca romper la operación original por la promoción de estado
  END;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_docs_promover_por_liquidar ON public.documentos_embarque;
CREATE TRIGGER trg_docs_promover_por_liquidar
AFTER INSERT OR UPDATE ON public.documentos_embarque
FOR EACH ROW EXECUTE FUNCTION public._trg_promover_por_liquidar();

DROP TRIGGER IF EXISTS trg_cont_promover_por_liquidar ON public.embarque_contenedores;
CREATE TRIGGER trg_cont_promover_por_liquidar
AFTER INSERT OR UPDATE ON public.embarque_contenedores
FOR EACH ROW EXECUTE FUNCTION public._trg_promover_por_liquidar();

-- 5) avanzar_estado_embarque: "Por liquidar" sólo valida lo operativo.
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_flr date;
  v_estado_actual public.estado_embarque;
  v_expediente text;
  v_tipo public.tipo_operacion;
  v_promovido boolean := false;
  v_estado_final text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Por liquidar','Cerrado'];
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id, fecha_llegada_real, estado, expediente, tipo
    INTO v_org_id, v_flr, v_estado_actual, v_expediente, v_tipo
  FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- v13.303.42: al confirmar un borrador sin folio, reservar expediente ahora.
  IF v_estado_actual = 'Borrador'::estado_embarque
     AND p_nuevo_estado = 'Confirmado'
     AND (v_expediente IS NULL OR v_expediente = '') THEN
    v_expediente := public.generar_expediente(v_tipo);
    UPDATE embarques SET expediente = v_expediente WHERE id = p_embarque_id;
  END IF;

  IF p_nuevo_estado = 'Cerrado' THEN
    PERFORM public.cerrar_embarque(p_embarque_id);

    PERFORM set_config('app.bypass_cierre','on', true);

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

    PERFORM set_config('app.bypass_cierre','off', true);

    v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Cerrado');
    PERFORM public.idempotency_store(p_request_id, v_resp);
    RETURN v_resp;
  END IF;

  IF p_nuevo_estado = 'Arribo' AND v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

  -- Cierre operativo automático: si al llegar a EIR ya está todo lo operativo,
  -- el embarque avanza solo a "Por liquidar".
  IF p_nuevo_estado = 'EIR' THEN
    BEGIN
      v_promovido := public.promover_embarque_por_liquidar(p_embarque_id);
    EXCEPTION WHEN OTHERS THEN
      v_promovido := false;
    END;
  END IF;

  v_estado_final := CASE WHEN v_promovido THEN 'Por liquidar' ELSE p_nuevo_estado END;

  v_resp := jsonb_build_object(
    'id', p_embarque_id,
    'estado', v_estado_final,
    'promovido_por_liquidar', v_promovido,
    'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

-- 6) cerrar_embarque: acepta "Por liquidar" y permite el cierre automático.
CREATE OR REPLACE FUNCTION public.cerrar_embarque(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_uid uuid := auth.uid();
  v_validacion jsonb;
  v_snapshot jsonb;
  v_pnl jsonb;
  v_is_admin boolean;
  v_forzado boolean := false;
  v_automatico boolean := COALESCE(current_setting('app.cierre_automatico', true), 'off') = 'on';
BEGIN
  IF v_uid IS NULL AND NOT v_automatico THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_is_admin :=
    has_role(v_uid,'super_admin') OR
    has_role(v_uid,'admin') OR
    has_role(v_uid,'admin_org');

  -- El cierre automático (disparado al liquidar el último saldo) no exige rol:
  -- exige el checklist completo, que es un candado más fuerte.
  IF NOT v_automatico AND NOT (
    v_is_admin OR
    has_role(v_uid,'gerente_operaciones') OR
    has_role(v_uid,'coordinador_logistico')
  ) THEN
    RAISE EXCEPTION 'No autorizado para cerrar embarques. Esta acción es responsabilidad del coordinador logístico.';
  END IF;

  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  IF v_emb.estado::text = 'Cerrado' THEN
    RAISE EXCEPTION 'El embarque ya está cerrado';
  END IF;

  IF v_emb.estado::text NOT IN ('Entregado','EIR','Por liquidar') THEN
    RAISE EXCEPTION 'Solo se pueden cerrar embarques en estado Entregado, EIR o Por liquidar (actual: %)', v_emb.estado::text;
  END IF;

  v_validacion := validar_cierre_embarque(p_embarque_id);
  IF NOT COALESCE((v_validacion->>'puede_cerrar')::boolean, false) THEN
    IF v_automatico THEN
      RAISE EXCEPTION 'LC_CIERRE_AUTOMATICO_NO_APLICA';
    ELSIF v_is_admin THEN
      -- Admins pueden forzar el cierre con checklist incompleto; queda registrado.
      v_forzado := true;
    ELSE
      RAISE EXCEPTION 'Validaciones de cierre no satisfechas: %', v_validacion::text;
    END IF;
  END IF;

  BEGIN
    v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;

  v_snapshot := jsonb_build_object(
    'cerrado_at', now(),
    'cerrado_por', v_uid,
    'forzado_admin', v_forzado,
    'automatico', v_automatico,
    'pnl', v_pnl,
    'validaciones', v_validacion,
    'totales', jsonb_build_object(
      'cxc_total', (SELECT COALESCE(sum(total),0) FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada'),
      'cxp_total', (SELECT COALESCE(sum(total),0) FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada'),
      'seguros_prima_total', (SELECT COALESCE(sum(prima),0) FROM seguros_embarque WHERE embarque_id = p_embarque_id AND deleted_at IS NULL)
    )
  );

  PERFORM set_config('app.bypass_cierre','on', true);

  UPDATE embarques
     SET estado = 'Cerrado'::estado_embarque,
         cerrado_at = now(),
         cerrado_por = v_uid,
         cerrado_snapshot = v_snapshot,
         reabierto_at = NULL,
         reabierto_por = NULL,
         reabierto_motivo = NULL,
         updated_at = now()
   WHERE id = p_embarque_id;

  UPDATE comisiones_devengadas
     SET definitiva = true,
         pnl_base = COALESCE((v_pnl->>'utilidad_mxn')::numeric, (v_pnl->>'utilidad')::numeric, 0),
         calculo_snapshot = v_pnl,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
  VALUES (
    p_embarque_id,
    v_emb.organization_id,
    CASE WHEN v_forzado THEN 'cerrar_forzado'
         WHEN v_automatico THEN 'cerrar_automatico'
         ELSE 'cerrar' END,
    v_uid,
    CASE WHEN v_forzado THEN 'Cierre forzado por administrador con checklist incompleto'
         WHEN v_automatico THEN 'Cierre automático: se liquidó el último saldo por cobrar y por pagar'
         ELSE NULL END,
    v_snapshot
  );

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      v_emb.organization_id,
      v_uid,
      CASE WHEN v_forzado THEN 'cerrar_embarque_forzado'
           WHEN v_automatico THEN 'cerrar_embarque_automatico'
           ELSE 'cerrar_embarque' END,
      'embarques',
      p_embarque_id,
      v_snapshot
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'forzado_admin', v_forzado, 'automatico', v_automatico, 'snapshot', v_snapshot);
END;
$function$;

-- 7) Cierre automático al liquidar el último saldo.
CREATE OR REPLACE FUNCTION public._trg_autocierre_por_liquidar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_embarque_id uuid;
  v_estado text;
BEGIN
  IF TG_TABLE_NAME = 'pagos_factura' THEN
    SELECT f.embarque_id INTO v_embarque_id
      FROM facturas f WHERE f.id = COALESCE(NEW.factura_id, OLD.factura_id);
  ELSE
    SELECT pf.embarque_id INTO v_embarque_id
      FROM proveedor_facturas pf WHERE pf.id = COALESCE(NEW.proveedor_factura_id, OLD.proveedor_factura_id);
  END IF;

  IF v_embarque_id IS NULL THEN RETURN NULL; END IF;

  SELECT estado::text INTO v_estado FROM embarques WHERE id = v_embarque_id;
  IF v_estado IS DISTINCT FROM 'Por liquidar' THEN RETURN NULL; END IF;

  BEGIN
    PERFORM set_config('app.cierre_automatico','on', true);
    PERFORM public.cerrar_embarque(v_embarque_id);
    PERFORM set_config('app.cierre_automatico','off', true);
  EXCEPTION WHEN OTHERS THEN
    -- Checklist incompleto o cualquier otro impedimento: el pago se guarda igual.
    PERFORM set_config('app.cierre_automatico','off', true);
  END;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pagos_factura_autocierre ON public.pagos_factura;
CREATE TRIGGER trg_pagos_factura_autocierre
AFTER INSERT OR UPDATE ON public.pagos_factura
FOR EACH ROW EXECUTE FUNCTION public._trg_autocierre_por_liquidar();

DROP TRIGGER IF EXISTS trg_pagos_proveedor_autocierre ON public.pagos_proveedor;
CREATE TRIGGER trg_pagos_proveedor_autocierre
AFTER INSERT OR UPDATE ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._trg_autocierre_por_liquidar();

-- 8) Reapertura: regresa al cierre administrativo, no a Entregado.
CREATE OR REPLACE FUNCTION public.reabrir_embarque(p_embarque_id uuid, p_usuario_email text, p_motivo text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_estado_actual text;
  v_resp jsonb;
  v_es_admin boolean;
  v_motivo text := NULLIF(trim(COALESCE(p_motivo, '')), '');
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  v_es_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role)
             OR public.has_role(auth.uid(), 'admin_org'::app_role);
  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir embarques cerrados';
  END IF;

  PERFORM public._assert_writer(v_org_id);

  IF v_estado_actual <> 'Cerrado' THEN
    RAISE EXCEPTION 'Solo embarques en estado Cerrado pueden reabrirse (estado actual: %)', v_estado_actual;
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);
  PERFORM set_config('app.bypass_transicion','on', true);

  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  PERFORM set_config('app.bypass_transicion','off', true);

  UPDATE comisiones_devengadas
     SET definitiva = false,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Por liquidar. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), p_usuario_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (v_org_id, auth.uid(), 'reabrir_embarque', 'embarques', p_embarque_id,
            jsonb_build_object('motivo', v_motivo));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Por liquidar');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.embarque_operativo_completo(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.promover_embarque_por_liquidar(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.embarque_operativo_completo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promover_embarque_por_liquidar(uuid) TO authenticated, service_role;