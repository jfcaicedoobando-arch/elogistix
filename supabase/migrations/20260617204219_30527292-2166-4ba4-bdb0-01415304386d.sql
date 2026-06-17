
-- Fix: las funciones de cierre/reapertura y el trigger genérico de bloqueo
-- referenciaban embarques.estatus, pero la columna real es embarques.estado.

CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_total numeric;
  v_cxc_pagado numeric;
  v_cxp_total numeric;
  v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_pnl jsonb;
  v_utilidad numeric;
  v_margen_min numeric;
  v_com_count int;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  -- 1) CxC totalmente cobrada
  SELECT COALESCE(sum(total),0) INTO v_cxc_total
  FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pf.monto),0) INTO v_cxc_pagado
  FROM pagos_factura pf
  JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada';
  v_ok := (v_cxc_total <= v_cxc_pagado + 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado)
  ));

  -- 2) CxP totalmente pagada
  SELECT COALESCE(sum(total),0) INTO v_cxp_total
  FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp
  JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)
  ));

  -- 3) Documentos requeridos
  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque de
  WHERE de.embarque_id = p_embarque_id
    AND de.requerido = true
    AND (de.archivo_url IS NULL OR de.archivo_url = '');
  v_ok := (v_docs_faltantes = 0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)
  ));

  -- 4) Margen mínimo
  BEGIN
    v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric, (v_pnl->>'utilidad')::numeric, 0);
  SELECT COALESCE((valor)::text::numeric, 0) INTO v_margen_min
  FROM configuracion_global WHERE categoria='cierre' AND clave='cierre_margen_minimo';
  v_ok := (v_utilidad >= COALESCE(v_margen_min, 0));
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','pnl_margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)
  ));

  -- 5) Comisión devengada
  SELECT count(*) INTO v_com_count
  FROM comisiones_devengadas cd
  WHERE cd.embarque_id = p_embarque_id;
  v_ok := true;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comision_calculada','ok',v_ok,
    'detalle', jsonb_build_object('comisiones_registradas', v_com_count)
  ));

  RETURN jsonb_build_object(
    'puede_cerrar', v_puede,
    'estatus_actual', v_emb.estado,
    'cerrado', (v_emb.estado = 'cerrado'),
    'checks', v_checks
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cerrar_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_uid uuid := auth.uid();
  v_validacion jsonb;
  v_snapshot jsonb;
  v_pnl jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (has_role(v_uid,'super_admin') OR has_role(v_uid,'admin') OR has_role(v_uid,'contador')) THEN
    RAISE EXCEPTION 'No autorizado para cerrar embarques';
  END IF;

  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  IF v_emb.estado = 'cerrado' THEN
    RAISE EXCEPTION 'El embarque ya está cerrado';
  END IF;

  IF v_emb.estado <> 'entregado' THEN
    RAISE EXCEPTION 'Solo se pueden cerrar embarques en estado entregado (actual: %)', v_emb.estado;
  END IF;

  v_validacion := validar_cierre_embarque(p_embarque_id);
  IF NOT COALESCE((v_validacion->>'puede_cerrar')::boolean, false) THEN
    RAISE EXCEPTION 'Validaciones de cierre no satisfechas: %', v_validacion::text;
  END IF;

  BEGIN
    v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;

  v_snapshot := jsonb_build_object(
    'cerrado_at', now(),
    'cerrado_por', v_uid,
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
     SET estado = 'cerrado',
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
  VALUES (p_embarque_id, v_emb.organization_id, 'cerrar', v_uid, NULL, v_snapshot);

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (v_emb.organization_id, v_uid, 'cerrar_embarque', 'embarques', p_embarque_id, v_snapshot);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'snapshot', v_snapshot);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cerrar_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_embarque(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reabrir_embarque(p_embarque_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin_puede boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT COALESCE((valor)::text::boolean, false) INTO v_admin_puede
  FROM configuracion_global
  WHERE categoria='cierre' AND clave='cierre_admin_puede_reabrir';

  IF NOT (has_role(v_uid,'super_admin') OR (v_admin_puede AND has_role(v_uid,'admin'))) THEN
    RAISE EXCEPTION 'No autorizado para reabrir embarques';
  END IF;

  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  IF v_emb.estado <> 'cerrado' THEN
    RAISE EXCEPTION 'El embarque no está cerrado';
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);

  UPDATE embarques
     SET estado = 'entregado',
         reabierto_at = now(),
         reabierto_por = v_uid,
         reabierto_motivo = p_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  UPDATE comisiones_devengadas
     SET definitiva = false,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
  VALUES (p_embarque_id, v_emb.organization_id, 'reabrir', v_uid, p_motivo,
          jsonb_build_object('snapshot_previo', v_emb.cerrado_snapshot));

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (v_emb.organization_id, v_uid, 'reabrir_embarque', 'embarques', p_embarque_id,
            jsonb_build_object('motivo', p_motivo));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_bloquear_si_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT estado INTO v_estado FROM embarques WHERE id = v_emb_id;
  IF v_estado = 'cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: edición bloqueada (tabla %)', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_bloquear_embarque_cerrado_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' AND OLD.estado = 'cerrado' THEN
    RAISE EXCEPTION 'No se puede eliminar un embarque cerrado';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado = 'cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: usa reabrir_embarque para modificarlo';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
