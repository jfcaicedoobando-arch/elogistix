-- =============================================================
-- 20260910000100_fix_cerrar_embarque_org_scope_y_lock_conceptos.sql
--
-- DEFECTO 1 (P0, cross-tenant): `cerrar_embarque` validaba roles con
-- `has_role` GLOBAL antes de conocer el embarque. Un coordinador/admin de la
-- org A con el UUID de un embarque de la org B podía cerrarlo (y forzar el
-- cierre si tenía rol admin en la org A). Arreglo: tras el
-- `SELECT ... FOR UPDATE`, se valida el rol EXACTO dentro de
-- `v_emb.organization_id` con `has_any_role_in_org_exact` (super_admin sigue
-- autorizado globalmente vía la semántica ya embebida en ese helper). No se
-- amplían permisos: los mismos 4 roles (admin, admin_org,
-- gerente_operaciones, coordinador_logistico) siguen siendo los únicos
-- autorizados, ahora evaluados en la org dueña del embarque.
-- `reabrir_embarque` tenía el mismo defecto en su check de admin global; se
-- corrige de forma consistente (sin ampliar permisos: admin/admin_org y
-- super_admin global, ahora org-scoped).
--
-- DEFECTO 2 (P1, carrera cierre vs conceptos): `cerrar_embarque` bloquea la
-- fila del embarque con FOR UPDATE, pero los triggers que validan "embarque
-- abierto" al insertar/editar en `conceptos_costo`/`conceptos_venta` (y otras
-- tablas hijas) leían `embarques.estado` sin candado, permitiendo que una
-- transacción insertara un concepto mientras otra cerraba el embarque, sin
-- quedar reflejado en el snapshot de cierre. Arreglo: se extrae el helper
-- `_assert_embarque_abierto_locked` que toma `FOR KEY SHARE` (compatible con
-- otras transacciones concurrentes que sólo leen, pero mutuamente exclusivo
-- con el `FOR UPDATE` de `cerrar_embarque`, y sin bloquear cascadas FK) y lee
-- el estado en esa misma lectura bloqueada. Los triggers
-- `bloquear_conceptos_en_embarque_cerrado` y `tg_bloquear_si_embarque_cerrado`
-- ahora usan ese helper.
-- =============================================================

-- ---- DEFECTO 2: helper de lectura bloqueada del estado del embarque ----
CREATE OR REPLACE FUNCTION public._assert_embarque_abierto_locked(p_embarque_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_estado text;
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN NULL;
  END IF;
  -- FOR KEY SHARE es mutuamente exclusivo con el FOR UPDATE de
  -- cerrar_embarque: si un cierre está en curso, esta lectura espera a que
  -- termine (commit o rollback) antes de decidir si el embarque sigue
  -- abierto, cerrando la ventana de carrera del DEFECTO 2.
  SELECT estado::text INTO v_estado
    FROM public.embarques
   WHERE id = p_embarque_id
   FOR KEY SHARE;
  RETURN v_estado;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_embarque_abierto_locked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_embarque_abierto_locked(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bloquear_conceptos_en_embarque_cerrado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_estado text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- DEFECTO 2: lectura bloqueada (FOR KEY SHARE) para no perder la carrera
  -- contra el FOR UPDATE de cerrar_embarque.
  v_estado := public._assert_embarque_abierto_locked(COALESCE(NEW.embarque_id, OLD.embarque_id));
  IF v_estado = 'Cerrado' THEN
    IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND current_setting('app.auditoria_backfill_legacy', true) = 'on'
       AND OLD.estado_facturacion = 'pendiente'
       AND NEW.estado_facturacion = 'facturado'
       AND (to_jsonb(NEW) - 'estado_facturacion') = (to_jsonb(OLD) - 'estado_facturacion') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'No se pueden agregar ni modificar conceptos en un embarque Cerrado. Reabre el embarque antes de editar.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_bloquear_si_embarque_cerrado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_emb_id uuid;
  v_estado text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_emb_id := COALESCE(
    (CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)->>'embarque_id' ELSE NULL END)::uuid,
    (CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)->>'embarque_id' ELSE NULL END)::uuid
  );
  IF v_emb_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- DEFECTO 2: lectura bloqueada (FOR KEY SHARE), misma razón que arriba.
  v_estado := public._assert_embarque_abierto_locked(v_emb_id);
  IF v_estado = 'Cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: edición bloqueada (tabla %)', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---- DEFECTO 1: cerrar_embarque org-scoped ----
CREATE OR REPLACE FUNCTION public.cerrar_embarque(p_embarque_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_uid uuid := auth.uid();
  v_validacion jsonb;
  v_snapshot jsonb;
  v_pnl jsonb;
  v_is_admin boolean;
  v_forzado boolean := false;
  v_automatico boolean := COALESCE(current_setting('app.cierre_automatico', true), 'off') = 'on';
  -- BL-09: cursor de recálculo de comisiones pendientes.
  v_pago_recalc uuid;
  v_recalculadas int := 0;
BEGIN
  IF v_uid IS NULL AND NOT v_automatico THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;
  -- DEFECTO 1: el rol se valida EN LA ORG DEL EMBARQUE (v_emb.organization_id),
  -- no de forma global. super_admin sigue autorizado globalmente por la
  -- semántica ya embebida en has_any_role_in_org_exact.
  v_is_admin :=
    NOT v_automatico AND
    public.has_any_role_in_org_exact(v_uid, ARRAY['admin','admin_org']::app_role[], v_emb.organization_id);
  IF NOT v_automatico AND NOT (
    v_is_admin OR
    public.has_any_role_in_org_exact(v_uid, ARRAY['gerente_operaciones','coordinador_logistico']::app_role[], v_emb.organization_id)
  ) THEN
    RAISE EXCEPTION 'No autorizado para cerrar embarques. Esta acción es responsabilidad del coordinador logístico.';
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
  -- BL-09: recalcular las comisiones del embarque que quedaron en 0 con nota
  -- de pendiente (TC faltante / costos capturados tarde). La función es
  -- idempotente y omite las ya 'Liquidada'. Un fallo individual no aborta el
  -- cierre: queda WARNING y la nota sigue marcando la comisión como pendiente.
  FOR v_pago_recalc IN
    SELECT pf.id
      FROM pagos_factura pf
      JOIN facturas f ON f.id = pf.factura_id
      JOIN comisiones_devengadas cd ON cd.pago_factura_id = pf.id
     WHERE f.embarque_id = p_embarque_id
       AND pf.deleted_at IS NULL
       AND cd.estado = 'Devengada'
       AND cd.nota IS NOT NULL
     ORDER BY pf.id
  LOOP
    BEGIN
      PERFORM public.calcular_comision_pago(v_pago_recalc);
      v_recalculadas := v_recalculadas + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'BL-09: recálculo de comisión del pago % falló: % %', v_pago_recalc, SQLSTATE, SQLERRM;
    END;
  END LOOP;
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
  PERFORM public.registrar_bitacora(
    'embarques',
    CASE WHEN v_forzado THEN 'cerrar_embarque_forzado'
         WHEN v_automatico THEN 'cerrar_embarque_automatico'
         ELSE 'cerrar_embarque' END,
    p_embarque_id,
    COALESCE(v_emb.expediente, ''),
    v_snapshot,
    v_emb.organization_id,
    v_uid
  );
  RETURN jsonb_build_object('ok', true, 'forzado_admin', v_forzado, 'automatico', v_automatico,
                            'comisiones_recalculadas', v_recalculadas,
                            'snapshot', v_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_embarque(p_embarque_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cerrar_embarque(p_embarque_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cerrar_embarque(p_embarque_id uuid) TO service_role;

-- ---- DEFECTO 1 (consistencia): reabrir_embarque también era global ----
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
  v_actor_id uuid := auth.uid();
  v_actor_email text;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id
     AND deleted_at IS NULL;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  -- DEFECTO 1 (consistencia): antes usaba has_role() GLOBAL; ahora se exige
  -- membresía admin/admin_org en LA ORG DEL EMBARQUE (super_admin sigue
  -- autorizado globalmente, semántica embebida en has_any_role_in_org_exact).
  v_es_admin := public.has_any_role_in_org_exact(v_actor_id, ARRAY['admin','admin_org']::app_role[], v_org_id);
  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir embarques cerrados';
  END IF;

  PERFORM public._assert_writer(v_org_id);

  IF v_estado_actual <> 'Cerrado' THEN
    RAISE EXCEPTION 'Solo embarques en estado Cerrado pueden reabrirse (estado actual: %)', v_estado_actual;
  END IF;

  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  PERFORM set_config('app.bypass_cierre','on', true);
  PERFORM set_config('app.bypass_transicion','on', true);

  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque,
         cerrado_snapshot = NULL,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  PERFORM set_config('app.bypass_transicion','off', true);

  UPDATE comisiones_devengadas
     SET definitiva = false,
         pnl_base = NULL,
         calculo_snapshot = NULL,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Por liquidar. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), v_actor_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM public.registrar_bitacora(
    'embarques', 'reabrir_embarque', p_embarque_id, '',
    jsonb_build_object('motivo', v_motivo), v_org_id, auth.uid()
  );

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Por liquidar');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO authenticated, service_role;
