
-- =========================================================
-- RPC: validar_cierre_embarque
-- =========================================================
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_cxc_pendientes int;
  v_cxp_pendientes int;
  v_docs_requeridos jsonb;
  v_docs_faltantes text[];
  v_margen_min numeric;
  v_pnl jsonb;
  v_utilidad numeric;
  v_com_count int;
  v_ok boolean;
  v_detalle jsonb;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('puede_cerrar', false, 'error', 'Embarque no encontrado');
  END IF;

  -- 1) CxC: no debe haber facturas vigentes con saldo > 0
  SELECT count(*) INTO v_cxc_pendientes
  FROM facturas f
  WHERE f.embarque_id = p_embarque_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada','Pagada')
    AND (f.total - COALESCE((SELECT sum(p.monto) FROM pagos_factura p WHERE p.factura_id = f.id), 0)) > 0.01;
  v_ok := (v_cxc_pendientes = 0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_sin_pendientes','ok',v_ok,
    'detalle', jsonb_build_object('facturas_con_saldo', v_cxc_pendientes)
  ));

  -- 2) CxP: facturas de proveedor del embarque deben estar Pagada/Cancelada
  SELECT count(*) INTO v_cxp_pendientes
  FROM proveedor_facturas pf
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL
    AND pf.estado NOT IN ('Pagada','Cancelada');
  v_ok := (v_cxp_pendientes = 0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_sin_pendientes','ok',v_ok,
    'detalle', jsonb_build_object('facturas_proveedor_pendientes', v_cxp_pendientes)
  ));

  -- 3) Documentos requeridos
  SELECT valor INTO v_docs_requeridos
  FROM configuracion_global
  WHERE categoria='cierre' AND clave='cierre_documentos_requeridos';
  v_docs_requeridos := COALESCE(v_docs_requeridos, '[]'::jsonb);

  SELECT COALESCE(array_agg(req), '{}')
  INTO v_docs_faltantes
  FROM (
    SELECT jsonb_array_elements_text(v_docs_requeridos) AS req
  ) r
  WHERE NOT EXISTS (
    SELECT 1 FROM documentos_embarque d
    WHERE d.embarque_id = p_embarque_id
      AND d.deleted_at IS NULL
      AND d.archivo IS NOT NULL
      AND lower(d.nombre) LIKE '%' || lower(r.req) || '%'
  );
  v_ok := (array_length(v_docs_faltantes,1) IS NULL);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','documentos_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', to_jsonb(v_docs_faltantes))
  ));

  -- 4) P&L margen mínimo
  SELECT COALESCE((valor)::text::numeric, 0) INTO v_margen_min
  FROM configuracion_global
  WHERE categoria='cierre' AND clave='pnl_margen_minimo_cierre';
  v_margen_min := COALESCE(v_margen_min, 0);

  BEGIN
    v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric,
                         (v_pnl->>'utilidad')::numeric,
                         0);
  v_ok := (v_utilidad >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','pnl_margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)
  ));

  -- 5) Comisión devengada existe (informativo; no bloqueante si no hay vendedora)
  SELECT count(*) INTO v_com_count
  FROM comisiones_devengadas cd
  WHERE cd.embarque_id = p_embarque_id;
  v_ok := true; -- informativo
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comision_calculada','ok',v_ok,
    'detalle', jsonb_build_object('comisiones_registradas', v_com_count)
  ));

  RETURN jsonb_build_object(
    'puede_cerrar', v_puede,
    'estatus_actual', v_emb.estatus,
    'cerrado', (v_emb.estatus = 'cerrado'),
    'checks', v_checks
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated;

-- =========================================================
-- RPC: cerrar_embarque
-- =========================================================
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

  IF v_emb.estatus = 'cerrado' THEN
    RAISE EXCEPTION 'El embarque ya está cerrado';
  END IF;

  IF v_emb.estatus <> 'entregado' THEN
    RAISE EXCEPTION 'Solo se pueden cerrar embarques en estado entregado (actual: %)', v_emb.estatus;
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

  -- Bypass triggers de bloqueo solo para esta operación
  PERFORM set_config('app.bypass_cierre','on', true);

  UPDATE embarques
     SET estatus = 'cerrado',
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

-- =========================================================
-- RPC: reabrir_embarque
-- =========================================================
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

  IF v_emb.estatus <> 'cerrado' THEN
    RAISE EXCEPTION 'El embarque no está cerrado';
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);

  UPDATE embarques
     SET estatus = 'entregado',
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

-- =========================================================
-- Trigger genérico de bloqueo de edición cuando embarque está cerrado
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_bloquear_si_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emb_id uuid;
  v_estatus text;
BEGIN
  -- Bypass durante RPCs autorizadas
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

  SELECT estatus INTO v_estatus FROM embarques WHERE id = v_emb_id;
  IF v_estatus = 'cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: edición bloqueada (tabla %)', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger a las tablas afectadas
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'conceptos_costo',
    'conceptos_venta',
    'documentos_embarque',
    'seguros_embarque',
    'eventos_embarque',
    'embarque_contenedores',
    'facturas',
    'proveedor_facturas',
    'pagos_factura',
    'pagos_proveedor'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_bloquear_cierre ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_bloquear_cierre BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_si_embarque_cerrado()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Trigger especial sobre embarques: impedir UPDATE/DELETE directo cuando cerrado
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
  IF TG_OP = 'DELETE' AND OLD.estatus = 'cerrado' THEN
    RAISE EXCEPTION 'No se puede eliminar un embarque cerrado';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.estatus = 'cerrado' THEN
    RAISE EXCEPTION 'Embarque cerrado: usa reabrir_embarque para modificarlo';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_embarque_self ON public.embarques;
CREATE TRIGGER trg_bloquear_embarque_self
BEFORE UPDATE OR DELETE ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_embarque_cerrado_self();
