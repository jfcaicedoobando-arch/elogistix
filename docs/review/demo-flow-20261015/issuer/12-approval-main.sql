-- GENERATED FROM EXACT main70a55d4 HUMAN BODY; review only. Public function remains untouched.
BEGIN;
DO $$ BEGIN IF (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc WHERE oid='public.aprobar_factura_proveedor(uuid,boolean,text,timestamptz)'::regprocedure) IS DISTINCT FROM 'd1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0' THEN RAISE EXCEPTION 'DEMO_HUMAN_SOURCE_DRIFT'; END IF; END $$;
CREATE FUNCTION demo_flow_writer.human_approval_main(p_id uuid,p_aprobar boolean,p_motivo text,p_expected_updated_at timestamptz) RETURNS public.proveedor_facturas
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_puede_autoaprobar_cxp boolean;
  v_desvinculo jsonb := '{}'::jsonb;
  v_estado_actual text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede aprobar ni rechazar facturas de proveedor.';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_puede_autoaprobar_cxp;
  -- A-3: FOR UPDATE serializa dos clics simultáneos sobre la misma factura.
  SELECT * INTO v_row FROM public.proveedor_facturas
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_row.organization_id
          AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NULL OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: la factura cambió desde que la revisaste. Recarga y revisa los datos actuales antes de decidir.'
      USING ERRCODE = 'PT409';
  END IF;
  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;
  -- SoD CxP: administradores y contador pueden aprobar su propia factura.
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_puede_autoaprobar_cxp
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: No puedes aprobar una factura que tú mismo capturaste. Pide la aprobación a otra persona.';
  END IF;
  -- Ola 4 (H2): al aprobar, `p_motivo` es la justificación del gasto sin respaldo.
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id, p_motivo);
  END IF;
  -- A-3: relectura redundante dentro del bloqueo (defensa ante validaciones
  -- que pudieran liberar el lock por subtransacciones).
  SELECT estado_aprobacion::text INTO v_estado_actual
    FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_estado_actual;
  END IF;
  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  PERFORM set_config('app.aprobando_cxp', '1', true);
  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  END IF;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La factura ya fue procesada por otra sesión. Recarga la pantalla.'
      USING ERRCODE = 'serialization_failure';
  END IF;
  IF NOT p_aprobar THEN
    -- v13.493.0 — el rechazo rompe el vínculo con el embarque.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;
  PERFORM set_config('app.aprobando_cxp', '0', true);
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, fuente_evento)
    VALUES (
      v_row.organization_id,
      v_uid,
      COALESCE(v_email, ''),
      CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
      'cxp',
      v_row.id,
      'Factura ' || COALESCE(v_row.folio_proveedor,'') || ' de ' || COALESCE(v_row.proveedor_nombre,''),
      jsonb_build_object(
        'motivo', p_motivo,
        'total', v_row.total,
        'moneda', v_row.moneda,
        'tipo_cambio_usd', v_row.tipo_cambio_usd,
        'aprobada', p_aprobar,
        'justificacion_sin_vinculo', v_row.justificacion_sin_vinculo
      ) || v_desvinculo,
      'rpc_aprobar_factura_proveedor'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;
CREATE FUNCTION demo_flow_writer.demo_approval_main(p_id uuid,p_aprobar boolean,p_motivo text,p_expected_updated_at timestamptz,p_run uuid,p_fixture text) RETURNS public.proveedor_facturas
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := NULL;
  v_email text;
  v_autorizado boolean;
  v_puede_autoaprobar_cxp boolean;
  v_desvinculo jsonb := '{}'::jsonb;
  v_estado_actual text;
  v_lineage uuid; v_event uuid;
BEGIN
  IF p_run IS NULL OR p_aprobar IS DISTINCT FROM true OR p_motivo IS NOT NULL THEN
    RAISE EXCEPTION 'DEMO_APPROVAL_SCOPE' USING ERRCODE='42501'; END IF;
  PERFORM demo_flow_writer.assert_issued(p_run);
  v_lineage := (demo_flow_writer.authorize(p_run)).id;
  PERFORM demo_flow_writer.verify_approval_candidate(p_run,p_fixture,p_id,p_expected_updated_at);
  -- A-3: FOR UPDATE serializa dos clics simultáneos sobre la misma factura.
  SELECT * INTO v_row FROM public.proveedor_facturas
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;
  IF p_expected_updated_at IS NULL OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: la factura cambió desde que la revisaste. Recarga y revisa los datos actuales antes de decidir.'
      USING ERRCODE = 'PT409';
  END IF;
  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;
  -- Ola 4 (H2): al aprobar, `p_motivo` es la justificación del gasto sin respaldo.
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id, p_motivo);
  END IF;
  -- A-3: relectura redundante dentro del bloqueo (defensa ante validaciones
  -- que pudieran liberar el lock por subtransacciones).
  SELECT estado_aprobacion::text INTO v_estado_actual
    FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_estado_actual;
  END IF;
  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  PERFORM set_config('app.aprobando_cxp', '1', true);
  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  END IF;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La factura ya fue procesada por otra sesión. Recarga la pantalla.'
      USING ERRCODE = 'serialization_failure';
  END IF;
  IF NOT p_aprobar THEN
    -- v13.493.0 — el rechazo rompe el vínculo con el embarque.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;
  PERFORM set_config('app.aprobando_cxp', '0', true);
  -- Mandatory audit: no exception swallowing, payment follows this receipt only.
  v_event:=demo_flow_writer.record_action(p_run,p_fixture,'approved');
  INSERT INTO demo_flow_writer.current_approvals(invoice_id,lineage_id,fixture_id,event_id)
    VALUES(p_id,v_lineage,p_fixture,v_event);
  RETURN v_row;
END;
$$;
CREATE FUNCTION demo_flow_writer.common_approval(p_id uuid,p_aprobar boolean,p_motivo text,p_expected_updated_at timestamptz,p_run uuid,p_fixture text) RETURNS public.proveedor_facturas
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 IF p_run IS NULL THEN RETURN demo_flow_writer.human_approval_main(p_id,p_aprobar,p_motivo,p_expected_updated_at); END IF;
 RETURN demo_flow_writer.demo_approval_main(p_id,p_aprobar,p_motivo,p_expected_updated_at,p_run,p_fixture);
END $$;
CREATE FUNCTION demo_flow_writer.clear_current_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
  IF OLD.estado_aprobacion='aprobada' AND NEW.estado_aprobacion='pendiente' THEN
    DELETE FROM demo_flow_writer.current_approvals WHERE invoice_id=NEW.id;
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER demo_clear_current_approval AFTER UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.clear_current_approval();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
