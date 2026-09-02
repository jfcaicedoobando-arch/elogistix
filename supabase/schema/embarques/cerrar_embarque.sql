-- Espejo canónico de public.cerrar_embarque
-- Fuente vigente (mayor timestamp): 20260902183746_81af79ca-850f-4e4d-9aea-398ba2e77eec.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.
-- DEFECTO 1 (P0, cross-tenant): el rol se valida EN LA ORG DEL EMBARQUE
-- (v_emb.organization_id) tras el SELECT ... FOR UPDATE, no de forma global.

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
