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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_is_admin :=
    has_role(v_uid,'super_admin') OR
    has_role(v_uid,'admin') OR
    has_role(v_uid,'admin_org');

  IF NOT (
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

  IF v_emb.estado::text NOT IN ('Entregado','EIR') THEN
    RAISE EXCEPTION 'Solo se pueden cerrar embarques en estado Entregado o EIR (actual: %)', v_emb.estado::text;
  END IF;

  v_validacion := validar_cierre_embarque(p_embarque_id);
  IF NOT COALESCE((v_validacion->>'puede_cerrar')::boolean, false) THEN
    IF v_is_admin THEN
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
    CASE WHEN v_forzado THEN 'cerrar_forzado' ELSE 'cerrar' END,
    v_uid,
    CASE WHEN v_forzado THEN 'Cierre forzado por administrador con checklist incompleto' ELSE NULL END,
    v_snapshot
  );

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (
      v_emb.organization_id,
      v_uid,
      CASE WHEN v_forzado THEN 'cerrar_embarque_forzado' ELSE 'cerrar_embarque' END,
      'embarques',
      p_embarque_id,
      v_snapshot
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'forzado_admin', v_forzado, 'snapshot', v_snapshot);
END;
$function$;