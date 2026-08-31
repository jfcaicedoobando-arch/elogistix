-- Ola v16 · Pulido Facturación → Cobranza → Pagos (sin features nuevas).
--
-- (1) reasignar_pago_factura: lock `FOR UPDATE` sobre el pago vivo + canon de
--     NC convertidas + tolerancia de sobrepago unificada con el trigger (0.005).
--     Fuente canónica: supabase/schema/facturacion/reasignar_pago_factura.sql
-- (2) cobranza_listado / cobranza_agregados: usan
--     public.nc_aplicadas_en_moneda_factura(f.id) en vez de SUM(n.monto).
-- Ninguna firma cambia.

CREATE OR REPLACE FUNCTION public.reasignar_pago_factura(
  p_pago_id uuid,
  p_factura_destino_id uuid,
  p_caso_id uuid DEFAULT NULL,
  p_ordenante_nombre text DEFAULT NULL,
  p_ordenante_rfc text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p public.pagos_factura%ROWTYPE;
  v_dest public.facturas%ROWTYPE;
  v_new_id uuid;
  v_saldo numeric;
  v_pagado numeric;
  v_ncs numeric;
  v_ord_nombre text := NULLIF(btrim(COALESCE(p_ordenante_nombre, '')), '');
  v_ord_rfc text := NULLIF(upper(btrim(COALESCE(p_ordenante_rfc, ''))), '');
BEGIN
  -- Ola v16 (1): dos reasignaciones simultáneas del MISMO pago (doble clic)
  -- leían la fila viva antes de que la otra la marcara como eliminada y
  -- duplicaban el importe en el destino. `FOR UPDATE` serializa a la segunda
  -- transacción; al liberarse el lock Postgres reevalúa el predicado
  -- `deleted_at IS NULL` y la segunda ya no encuentra el pago vivo.
  SELECT * INTO v_p FROM public.pagos_factura
   WHERE id = p_pago_id AND deleted_at IS NULL
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_PAGO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  -- Revalidación explícita post-lock (defensa en profundidad).
  IF v_p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_REFACT_PAGO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_p.organization_id);

  IF v_p.uuid_rep IS NOT NULL AND v_p.rep_cancelado_en IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_REP_VIVO: cancela el complemento de pago (REP) antes de reasignar el pago'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_ord_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_ORDENANTE_REQUERIDO: captura el nombre de la empresa que realizó el depósito'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_ord_rfc IS NOT NULL AND NOT public._rfc_valido(v_ord_rfc, true) THEN
    RAISE EXCEPTION 'LC_REFACT_RFC_INVALIDO: el RFC del ordenante (%) no tiene formato válido del SAT', v_ord_rfc
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dest FROM public.facturas WHERE id = p_factura_destino_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  IF v_dest.organization_id <> v_p.organization_id THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_OTRA_ORG' USING ERRCODE = '42501';
  END IF;
  IF v_dest.uuid_fiscal IS NULL OR v_dest.estado IN ('Borrador','Cancelada','Sustituida') THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_TIMBRADA: la factura destino debe estar timbrada y vigente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_dest.moneda <> v_p.moneda THEN
    RAISE EXCEPTION 'LC_REFACT_MONEDA_INCONSISTENTE: el pago está en % y la factura destino en %', v_p.moneda, v_dest.moneda
      USING ERRCODE = 'P0001';
  END IF;
  IF v_dest.moneda <> 'MXN' AND COALESCE(v_p.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_REFACT_TC_REQUERIDO: el pago en % requiere tipo de cambio', v_dest.moneda
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM public.pagos_factura
  WHERE factura_id = p_factura_destino_id AND deleted_at IS NULL;
  -- Ola v16 (1): canon único de NC convertidas a la moneda de la factura
  -- (no sumar `monto` crudo, que mezcla monedas).
  v_ncs := public.nc_aplicadas_en_moneda_factura(p_factura_destino_id);
  v_saldo := COALESCE(v_dest.total, 0) - v_pagado - v_ncs;

  -- Tolerancia canónica del trigger de sobrepago: 0.005 (medio centavo).
  IF ROUND(v_p.monto_aplicado_factura, 2) > ROUND(v_saldo, 2) + 0.005 THEN
    RAISE EXCEPTION 'LC_REFACT_SOBREPAGO: el pago (%) excede el saldo de la factura destino (%)',
      v_p.monto_aplicado_factura, v_saldo USING ERRCODE = 'P0001';
  END IF;

  -- 1) Baja lógica del pago original.
  UPDATE public.pagos_factura
     SET deleted_at = now(), deleted_by = auth.uid(),
         notas = COALESCE(notas, '') || ' [Reasignado a factura ' || COALESCE(v_dest.numero, '') || ']',
         refacturacion_id = COALESCE(p_caso_id, refacturacion_id)
   WHERE id = p_pago_id;

  -- 2) Alta del pago equivalente en la factura destino.
  INSERT INTO public.pagos_factura (
    factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, referencia, notas,
    diferencia_cambiaria_mxn, embarque_id, cuenta_bancaria_id, created_by,
    ordenante_distinto, ordenante_nombre, ordenante_rfc, refacturacion_id
  ) VALUES (
    p_factura_destino_id, v_p.organization_id, v_p.fecha_pago, v_p.monto, v_p.moneda, v_p.tipo_cambio,
    v_p.monto_aplicado_factura, v_p.forma_pago, v_p.referencia,
    COALESCE(v_p.notas, '') || ' [Reasignado desde pago ' || p_pago_id::text || ']',
    COALESCE(v_p.diferencia_cambiaria_mxn, 0), v_dest.embarque_id, v_p.cuenta_bancaria_id, auth.uid(),
    true, v_ord_nombre, v_ord_rfc, p_caso_id
  )
  RETURNING id INTO v_new_id;

  -- 3) Traslado del movimiento bancario.
  UPDATE public.bbva_movimientos
     SET pago_factura_id = v_new_id,
         estado_conciliacion = 'Conciliado',
         conciliado_por = auth.uid(),
         conciliado_at = now()
   WHERE pago_factura_id = p_pago_id;

  IF p_caso_id IS NOT NULL THEN
    UPDATE public.refacturaciones
       SET pago_original_id = COALESCE(pago_original_id, p_pago_id),
           pago_nuevo_id = v_new_id,
           paso_actual = 5
     WHERE id = p_caso_id;
  END IF;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_p.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_pago_reasignado', 'facturacion', p_factura_destino_id,
    COALESCE(v_dest.numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'pago_original_id', p_pago_id,
                       'pago_nuevo_id', v_new_id, 'monto', v_p.monto, 'moneda', v_p.moneda,
                       'ordenante_nombre', v_ord_nombre)
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.cobranza_listado(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_estatus text DEFAULT NULL,
  p_limit integer DEFAULT 2000
)
RETURNS TABLE(
  id uuid,
  numero text,
  cliente_id uuid,
  cliente_nombre text,
  expediente text,
  moneda text,
  total numeric,
  pagado numeric,
  notas_credito_aplicadas numeric,
  saldo numeric,
  fecha_emision date,
  fecha_vencimiento date,
  dias_vencido integer,
  estatus_cobranza text,
  estado_factura text,
  tipo_cambio numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
BEGIN
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cartera AS (
    SELECT
      f.id,
      f.numero,
      f.cliente_id,
      f.cliente_nombre,
      f.expediente,
      f.moneda::text AS moneda,
      f.total,
      COALESCE(pg.pagado, 0)::numeric AS pagado,
      COALESCE(nc.notas, 0)::numeric AS notas,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0))::numeric AS saldo,
      f.fecha_emision,
      f.fecha_vencimiento,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento)::integer AS dias_vencido,
      f.estado::text AS estado_factura,
      f.tipo_cambio
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    -- Ola v16 (2): canon único `nc_aplicadas_en_moneda_factura` — la suma
    -- cruda de `n.monto` mezclaba monedas (NC en USD restadas a facturas MXN)
    -- y devolvía saldos y KPIs de cartera incorrectos.
    LEFT JOIN LATERAL (
      SELECT public.nc_aplicadas_en_moneda_factura(f.id) AS notas
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND f.organization_id = v_org
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
      AND (
        p_search IS NULL OR p_search = ''
        OR f.numero ILIKE '%' || p_search || '%'
        OR f.cliente_nombre ILIKE '%' || p_search || '%'
      )
  ), clasificada AS (
    SELECT c.*,
      CASE
        WHEN c.saldo <= 0.01 THEN 'Sin saldo'
        WHEN c.dias_vencido > 0 THEN 'Vencida'
        WHEN c.dias_vencido BETWEEN -7 AND 0 THEN 'Por vencer'
        ELSE 'Vigente'
      END AS estatus
    FROM cartera c
  )
  SELECT
    cl.id, cl.numero, cl.cliente_id, cl.cliente_nombre, cl.expediente,
    cl.moneda, cl.total, cl.pagado, cl.notas, cl.saldo,
    cl.fecha_emision, cl.fecha_vencimiento, cl.dias_vencido,
    cl.estatus, cl.estado_factura, cl.tipo_cambio
  FROM clasificada cl
  WHERE p_estatus IS NULL OR p_estatus = '' OR p_estatus = 'todos'
     OR cl.estatus = p_estatus
  ORDER BY cl.fecha_vencimiento ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cobranza_agregados(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    -- Ola v16 (2): canon único `nc_aplicadas_en_moneda_factura` — la suma
    -- cruda de `n.monto` mezclaba monedas (NC en USD restadas a facturas MXN)
    -- y devolvía saldos y KPIs de cartera incorrectos.
    LEFT JOIN LATERAL (
      SELECT public.nc_aplicadas_en_moneda_factura(f.id) AS notas
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND f.organization_id = public.org_scope()
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
  )
  SELECT jsonb_build_object(
    'total_mxn',          COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0), 0),
    'total_usd',          COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0), 0),
    'vencido_mxn',        COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',        COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'por_vencer_7d_mxn',  COALESCE(SUM(saldo) FILTER (WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'por_vencer_7d_usd',  COALESCE(SUM(saldo) FILTER (WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'facturas_vencidas',  COUNT(*) FILTER (WHERE moneda IN ('MXN','USD') AND saldo > 0 AND dias_vencido > 0),
    'facturas_con_saldo', COUNT(*) FILTER (WHERE saldo > 0)
  ) INTO v_result
  FROM cartera;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_agregados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_agregados(uuid, text) TO authenticated;