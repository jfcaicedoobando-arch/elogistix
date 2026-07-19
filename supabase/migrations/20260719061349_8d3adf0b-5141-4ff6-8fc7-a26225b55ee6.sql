-- Fase R.7 (v13.301.97)

-- 1) Bug 3 residual: revertir_proforma_al_cancelar_sustitucion cuenta borradores como vivos
CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion(p_factura_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_liberadas uuid[] := ARRAY[]::uuid[];
  v_facturas_vivas int;
  v_proforma_id_directa uuid;
  v_org uuid;
BEGIN
  SELECT organization_id, proforma_id INTO v_org, v_proforma_id_directa
  FROM public.facturas WHERE id = p_factura_id;

  IF v_proforma_id_directa IS NOT NULL THEN
    v_ids := array_append(v_ids, v_proforma_id_directa);
  END IF;

  v_ids := v_ids || COALESCE(
    (SELECT array_agg(DISTINCT proforma_id_origen)
       FROM public.conceptos_factura
      WHERE factura_id = p_factura_id
        AND deleted_at IS NULL
        AND proforma_id_origen IS NOT NULL),
    ARRAY[]::uuid[]
  );

  v_ids := array(
    SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL
  );

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN v_liberadas;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    -- Fase R.7: los borradores TAMBIÉN cuentan como vivos porque siguen
    -- consumiendo conceptos y pueden timbrarse.
    SELECT count(*) INTO v_facturas_vivas
    FROM public.facturas f
    WHERE f.estado NOT IN ('Cancelada','Sustituida')
      AND f.id <> p_factura_id
      AND (
        f.proforma_id = v_id
        OR EXISTS (
          SELECT 1 FROM public.conceptos_factura cf
           WHERE cf.factura_id = f.id
             AND cf.deleted_at IS NULL
             AND cf.proforma_id_origen = v_id
        )
      );

    IF v_facturas_vivas = 0 THEN
      UPDATE public.proformas
         SET estado_proforma   = 'pendiente',
             fecha_facturacion = NULL,
             updated_at        = now()
       WHERE id = v_id
         AND estado_proforma = 'facturada';

      IF FOUND THEN
        v_liberadas := array_append(v_liberadas, v_id);
        INSERT INTO public.bitacora_actividad (
          organization_id, usuario_id, usuario_email,
          accion, modulo, entidad_id, entidad_nombre, detalles
        ) VALUES (
          v_org, auth.uid(), NULL,
          'revertir_proforma_cancelacion_sustitucion', 'facturacion',
          v_id, NULL,
          jsonb_build_object('factura_id', p_factura_id)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_liberadas;
END;
$function$;

COMMENT ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid)
IS 'Fase R.7: al cancelar/sustituir una factura, libera la(s) proforma(s) a estado pendiente sólo si NO existen otras facturas vivas (incluyendo borradores) consumiendo sus conceptos.';

-- 2) Bug menor A: bloquear INSERT de NC proveedor con estado <> Borrador
CREATE OR REPLACE FUNCTION public.enforce_nc_proveedor_estado_transicion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.estado_nota_credito_proveedor;
  v_new public.estado_nota_credito_proveedor := NEW.estado;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_new IS DISTINCT FROM 'Borrador' THEN
      RAISE EXCEPTION 'LC_NC_PROV_INSERT_ESTADO_INVALIDO'
        USING HINT = 'Una nota de crédito de proveedor debe crearse en estado Borrador.',
              ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  v_old := OLD.estado;

  IF v_old = v_new THEN
    RETURN NEW;
  END IF;

  IF v_old = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_NC_PROV_ESTADO_TERMINAL'
      USING HINT = 'La nota de crédito está Cancelada y no admite cambios de estado.',
            ERRCODE = 'P0001';
  END IF;

  IF v_old = 'Borrador' AND v_new IN ('Aprobada','Cancelada') THEN
    RETURN NEW;
  END IF;

  IF v_old = 'Aprobada' AND v_new IN ('Aplicada','Cancelada') THEN
    RETURN NEW;
  END IF;

  IF v_old = 'Aplicada' AND v_new = 'Cancelada' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_NC_PROV_TRANSICION_INVALIDA'
    USING HINT = format('No se puede pasar de %s a %s.', v_old, v_new),
          ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_prov_estado_machine ON public.proveedor_notas_credito;
CREATE TRIGGER trg_nc_prov_estado_machine
BEFORE INSERT OR UPDATE OF estado ON public.proveedor_notas_credito
FOR EACH ROW
EXECUTE FUNCTION public.enforce_nc_proveedor_estado_transicion();

-- 3) Bug menor B: eliminar_embarque_completo cuenta TODAS las proformas vivas (no sólo pendientes aprobadas)
CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_uemail text;
  v_now timestamptz := now();
  v_expediente text;
  v_org uuid;
  v_cotizacion_id uuid;
  v_estado text;
  v_cerrado_at timestamptz;
  v_facturas int;
  v_cxp int;
  v_pagos_cxc int;
  v_pagos_cxp int;
  v_ncs_cxc int;
  v_ncs_cxp int;
  v_comisiones int;
  v_proformas int;
  v_remaining int;
  v_motivos jsonb;
BEGIN
  SELECT expediente, organization_id, cotizacion_id, estado, cerrado_at
    INTO v_expediente, v_org, v_cotizacion_id, v_estado, v_cerrado_at
  FROM public.embarques WHERE id = p_embarque_id;

  IF v_expediente IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  SELECT count(*) INTO v_facturas
  FROM public.facturas
  WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado NOT IN ('Cancelada','Sustituida');

  SELECT count(*) INTO v_cxp
  FROM public.proveedor_facturas
  WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  SELECT count(*) INTO v_pagos_cxc
  FROM public.pagos_factura pf
  JOIN public.facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id AND pf.deleted_at IS NULL;

  SELECT count(*) INTO v_pagos_cxp
  FROM public.pagos_proveedor pp
  JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pp.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxc
  FROM public.factura_notas_credito nc
  JOIN public.facturas f ON f.id = nc.factura_id
  WHERE f.embarque_id = p_embarque_id AND nc.deleted_at IS NULL;

  SELECT count(*) INTO v_ncs_cxp
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND nc.deleted_at IS NULL;

  SELECT count(*) INTO v_comisiones
  FROM public.comisiones_devengadas
  WHERE embarque_id = p_embarque_id
    AND definitiva = true;

  -- Fase R.7: contar TODAS las proformas vivas (borrador + pendientes + aprobadas),
  -- excluyendo sólo canceladas y facturadas (esas ya se resuelven por otra vía).
  SELECT count(*) INTO v_proformas
  FROM public.proformas
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND COALESCE(estado_proforma, 'pendiente') NOT IN ('cancelada','facturada');

  IF v_facturas > 0
     OR v_cxp > 0
     OR v_pagos_cxc > 0
     OR v_pagos_cxp > 0
     OR v_ncs_cxc > 0
     OR v_ncs_cxp > 0
     OR v_comisiones > 0
     OR v_proformas > 0
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
      'proformas', v_proformas,
      'cerrado', (v_estado = 'Cerrado' OR v_cerrado_at IS NOT NULL),
      'expediente', v_expediente
    );
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_expediente
      USING HINT = v_motivos::text,
            ERRCODE = 'check_violation';
  END IF;

  UPDATE public.conceptos_venta        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.conceptos_costo        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.documentos_embarque    SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.notas_embarque         SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.eventos_embarque       SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.embarque_contenedores  SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.seguros_embarque       SET deleted_at = v_now                    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones SET estado = 'Aceptada' WHERE id = v_cotizacion_id;
    END IF;
  END IF;

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

-- 4) Bug menor C: bloquear soft-delete de proformas facturadas
CREATE OR REPLACE FUNCTION public.enforce_proforma_no_soft_delete_facturada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.deleted_at IS NULL
     AND NEW.deleted_at IS NOT NULL
     AND OLD.estado_proforma = 'facturada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_FACTURADA_NO_ELIMINABLE'
      USING HINT = 'No se puede eliminar una proforma facturada. Cancela primero la factura relacionada.',
            ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proforma_no_soft_delete_facturada ON public.proformas;
CREATE TRIGGER trg_proforma_no_soft_delete_facturada
BEFORE UPDATE OF deleted_at ON public.proformas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_proforma_no_soft_delete_facturada();
