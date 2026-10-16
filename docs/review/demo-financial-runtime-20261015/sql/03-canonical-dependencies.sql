CREATE FUNCTION public.roles_jerarquia(_role public.app_role) RETURNS public.app_role[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _role
    WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
    WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
    WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
    WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
    WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','auxiliar_contable','ejecutivo_cobranza','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
    WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
    WHEN 'contador'::app_role THEN ARRAY['contador','auxiliar_contable','admin_org','super_admin']::app_role[]
    WHEN 'tesorero'::app_role THEN ARRAY['tesorero','admin_org','super_admin']::app_role[]
    WHEN 'auxiliar_contable'::app_role THEN ARRAY['auxiliar_contable','contador','admin_org','super_admin']::app_role[]
    WHEN 'ejecutivo_cobranza'::app_role THEN ARRAY['ejecutivo_cobranza','contador','admin_org','super_admin']::app_role[]
    ELSE ARRAY[_role]::app_role[]
  END
$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (public.roles_jerarquia(_role))
  )
$$;

CREATE FUNCTION public.tc_dof_vigente(_fecha date DEFAULT CURRENT_DATE) RETURNS TABLE(fecha date, usd_mxn numeric, eur_mxn numeric, fuente text, origen text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT t.fecha, t.usd_mxn, t.eur_mxn, t.fuente, t.origen
  FROM public.tipos_cambio_dof t
  WHERE t.fecha <= _fecha
  ORDER BY t.fecha DESC
  LIMIT 1
$$;

CREATE FUNCTION public.tc_para_documento(_fecha date, _moneda text, _tc_documento numeric DEFAULT NULL::numeric, _tc_embarque numeric DEFAULT NULL::numeric) RETURNS TABLE(tc numeric, origen text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_moneda text := UPPER(COALESCE(_moneda, 'MXN'));
  v_dof numeric;
BEGIN
  IF v_moneda = 'MXN' THEN
    RETURN QUERY SELECT 1::numeric, 'mxn'::text;
    RETURN;
  END IF;
  IF COALESCE(_tc_documento, 0) > 1 THEN
    RETURN QUERY SELECT _tc_documento::numeric, 'cfdi'::text;
    RETURN;
  END IF;
  IF _fecha IS NOT NULL THEN
    SELECT CASE WHEN v_moneda = 'USD' THEN d.usd_mxn
                WHEN v_moneda = 'EUR' THEN d.eur_mxn END
      INTO v_dof
    FROM public.tc_dof_vigente(_fecha) d;
    IF COALESCE(v_dof, 0) > 1 THEN
      RETURN QUERY SELECT v_dof::numeric, 'dof'::text;
      RETURN;
    END IF;
  END IF;
  IF COALESCE(_tc_embarque, 0) > 1 THEN
    RETURN QUERY SELECT _tc_embarque::numeric, 'embarque'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT NULL::numeric, 'sin_tc'::text;
END;
$$;

CREATE FUNCTION public.a_mxn_doc(_monto numeric, _moneda text, _fecha date, _tc_documento numeric DEFAULT NULL::numeric, _tc_embarque numeric DEFAULT NULL::numeric) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN _monto IS NULL THEN NULL
    WHEN UPPER(COALESCE(_moneda, 'MXN')) = 'MXN' THEN _monto
    WHEN t.tc IS NULL THEN NULL
    ELSE round(_monto * t.tc, 4)
  END
  FROM public.tc_para_documento(_fecha, _moneda, _tc_documento, _tc_embarque) t;
$$;

CREATE FUNCTION public.cxp_umbral_sin_vinculo(p_org uuid) RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT COALESCE((
    SELECT CASE
             WHEN NULLIF(c.valor #>> '{}', '') ~ '^[0-9]+(\.[0-9]+)?$'
               THEN (c.valor #>> '{}')::numeric
             ELSE NULL
           END
    FROM public.configuracion c
    WHERE c.organization_id = p_org
      AND c.categoria = 'compras'
      AND c.clave = 'umbral_aprobacion_sin_vinculo'
    LIMIT 1
  ), 50000)::numeric;
$_$;

CREATE FUNCTION public._cxp_desvincular_por_rechazo(p_id uuid, p_motivo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_pagado numeric;
  v_vinculos int := 0;
  v_ajustes int := 0;
  v_entrantes int := 0;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_id AND deleted_at IS NULL;
  IF v_pagado > 0 OR v_row.estado = 'Pagada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_CXP_RECHAZO_CON_PAGOS: la factura tiene pagos aplicados; anúlalos antes de rechazarla.'
      USING ERRCODE = '22023';
  END IF;
  -- Cancelar la factura: dispara la reversión de conceptos de ajuste
  -- (tg_reverse_ajustes_factura_proveedor) dentro de la misma transacción.
  IF v_row.estado <> 'Cancelada'::public.estado_proveedor_factura THEN
    PERFORM set_config('app.cancelando_cxp', '1', true);
    UPDATE public.proveedor_facturas
       SET estado = 'Cancelada'::public.estado_proveedor_factura,
           fecha_cancelacion = now(),
           motivo_cancelacion = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
           cancelada_por = auth.uid(),
           updated_at = now()
     WHERE id = p_id;
    PERFORM set_config('app.cancelando_cxp', '0', true);
  END IF;
  SELECT count(*) INTO v_ajustes
  FROM public.conceptos_costo cc
  JOIN public.proveedor_facturas_conceptos pfc ON pfc.concepto_costo_id = cc.id
  WHERE pfc.proveedor_factura_id = p_id
    AND cc.origen = 'ajuste_factura_proveedor'
    AND cc.deleted_at IS NOT NULL;
  -- Romper el vínculo con los conceptos de costo: vuelven a "pendiente de factura".
  DELETE FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = p_id;
  GET DIAGNOSTICS v_vinculos = ROW_COUNT;
  -- Soltar el embarque.
  UPDATE public.proveedor_facturas SET embarque_id = NULL, updated_at = now() WHERE id = p_id;
  -- Ola 6 · RG5-3: el archivo entrante queda rechazado Y SIN VÍNCULO a la
  -- factura cancelada, para que pueda retirarse o reactivarse después.
  UPDATE public.embarque_facturas_entrantes
     SET estado = 'rechazada',
         rechazo_motivo = COALESCE(NULLIF(btrim(p_motivo), ''), 'Factura rechazada'),
         proveedor_factura_id = NULL,
         capturado_por = NULL,
         updated_at = now()
   WHERE proveedor_factura_id = p_id
     AND deleted_at IS NULL;
  GET DIAGNOSTICS v_entrantes = ROW_COUNT;
  RETURN jsonb_build_object(
    'vinculos_eliminados', v_vinculos,
    'ajustes_revertidos', v_ajustes,
    'entrantes_rechazados', v_entrantes,
    'embarque_liberado', v_row.embarque_id
  );
END;
$$;

CREATE FUNCTION public.guard_aprobacion_proveedor_factura() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.estado_aprobacion IS NOT DISTINCT FROM OLD.estado_aprobacion THEN
    RETURN NEW;
  END IF;
  -- Volver a 'pendiente' (re-aprobación tras editar la factura) no otorga
  -- aprobación: se permite por el canal normal de edición.
  IF NEW.estado_aprobacion = 'pendiente'::public.estado_aprobacion_factura_proveedor THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.aprobando_cxp', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'LC_CXP_APROBACION_DIRECTA: use aprobar_factura_proveedor()'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
