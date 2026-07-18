
CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_uid uuid := auth.uid();
  v_uemail text;
  v_org uuid;
  v_expediente text;
  v_estado text;
  v_cerrado_at timestamptz;
  v_cotizacion_id uuid;
  v_remaining int;
  v_facturas int;
  v_cxp int;
  v_pagos_cxc int;
  v_pagos_cxp int;
  v_ncs_cxc int;
  v_ncs_cxp int;
  v_comisiones int;
  v_motivos jsonb;
BEGIN
  -- 1) Guard de existencia
  SELECT expediente, estado::text, cerrado_at, cotizacion_id, organization_id
    INTO v_expediente, v_estado, v_cerrado_at, v_cotizacion_id, v_org
  FROM public.embarques
  WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no existe o ya está eliminado', p_embarque_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2) Recolectar dependencias fiscales
  SELECT count(*) INTO v_facturas
  FROM public.facturas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND estado NOT IN ('Cancelada', 'Sustituida');

  SELECT count(*) INTO v_cxp
  FROM public.proveedor_facturas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND estado <> 'Cancelada';

  SELECT count(*) INTO v_pagos_cxc
  FROM public.pagos_factura pf
  JOIN public.facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL
    AND f.deleted_at IS NULL;

  SELECT count(*) INTO v_pagos_cxp
  FROM public.pagos_proveedor pp
  JOIN public.proveedor_facturas pf ON pf.id = pp.factura_id
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxc
  FROM public.factura_notas_credito nc
  JOIN public.facturas f ON f.id = nc.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND nc.deleted_at IS NULL
    AND f.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxp
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.factura_id
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL;

  SELECT count(*) INTO v_comisiones
  FROM public.comisiones_devengadas
  WHERE embarque_id = p_embarque_id
    AND definitiva = true;

  -- 3) Si alguna guarda se dispara, abortar con JSON de motivos en el HINT
  IF v_facturas > 0
     OR v_cxp > 0
     OR v_pagos_cxc > 0
     OR v_pagos_cxp > 0
     OR v_ncs_cxc > 0
     OR v_ncs_cxp > 0
     OR v_comisiones > 0
     OR v_estado = 'Cerrado'
     OR v_cerrado_at IS NOT NULL
  THEN
    v_motivos := jsonb_build_object(
      'facturas', v_facturas,
      'cxp', v_cxp,
      'pagos_cxc', v_pagos_cxc,
      'pagos_cxp', v_pagos_cxp,
      'notas_credito_cxc', v_ncs_cxc,
      'notas_credito_cxp', v_ncs_cxp,
      'comisiones_definitivas', v_comisiones,
      'cerrado', (v_estado = 'Cerrado' OR v_cerrado_at IS NOT NULL),
      'expediente', v_expediente
    );
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_expediente
      USING HINT = v_motivos::text,
            ERRCODE = 'check_violation';
  END IF;

  -- 4) Sin dependencias: soft-delete de hijos operativos (nunca facturas)
  UPDATE public.conceptos_venta        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.conceptos_costo        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.documentos_embarque    SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.notas_embarque         SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.eventos_embarque       SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.embarque_contenedores  SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.seguros_embarque       SET deleted_at = v_now                    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  -- 5) Soft-delete del embarque padre
  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  -- 6) Revertir cotización si no quedan embarques vivos
  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id;
    END IF;
  END IF;

  -- 7) Bitácora (email best-effort; si falla el lookup no bloqueamos)
  BEGIN
    SELECT email INTO v_uemail FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_uemail := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
    VALUES
      (v_uid, v_uemail, 'eliminar_embarque', 'embarques', p_embarque_id, v_expediente,
       jsonb_build_object(
         'cotizacion_revertida', (v_cotizacion_id IS NOT NULL AND v_remaining = 0),
         'estado_previo', v_estado
       ),
       v_org);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.eliminar_embarque_completo(uuid) TO authenticated, service_role;
