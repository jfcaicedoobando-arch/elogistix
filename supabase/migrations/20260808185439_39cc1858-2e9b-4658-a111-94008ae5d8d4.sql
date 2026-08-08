CREATE OR REPLACE FUNCTION public.pago_detalle(p_tipo text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org         uuid;
  v_super       boolean;
  v_pago        jsonb := NULL;
  v_mov         jsonb := NULL;
  v_aplic       jsonb := '[]'::jsonb;
  v_org_pago    uuid;
  v_lote        uuid := NULL;
  v_tipo        text;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_PARAMS: falta el identificador del pago';
  END IF;

  v_tipo := lower(coalesce(p_tipo, ''));
  IF v_tipo NOT IN ('cobro','pago','anticipo','lote') THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_TIPO: tipo de pago no soportado (%)', p_tipo;
  END IF;

  v_org := current_user_org_id();
  v_super := has_role(auth.uid(), 'super_admin');
  IF v_org IS NULL AND NOT v_super THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ORG: no se pudo determinar tu organización';
  END IF;

  IF v_tipo = 'cobro' THEN
    SELECT pf.organization_id,
           jsonb_build_object(
             'id', pf.id, 'tipo', 'cobro', 'fecha', pf.fecha_pago,
             'contraparte', c.nombre, 'contraparte_id', f.cliente_id,
             'moneda', pf.moneda::text, 'monto', COALESCE(pf.monto,0),
             'tipo_cambio', COALESCE(pf.tipo_cambio,1),
             'monto_mxn', CASE WHEN pf.moneda::text='MXN' THEN COALESCE(pf.monto,0)
                               ELSE COALESCE(pf.monto,0)*COALESCE(pf.tipo_cambio,1) END,
             'metodo_pago', pf.forma_pago, 'referencia', pf.referencia,
             'cuenta_bancaria_id', pf.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pf.notas, 'embarque_id', pf.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pf.diferencia_cambiaria_mxn,0),
             'estado_rep', pf.estado_rep,
             'folio_rep', NULLIF(TRIM(COALESCE(pf.serie_rep,'')||COALESCE(pf.folio_rep::text,'')),''),
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'created_by', pf.created_by, 'created_at', pf.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    LEFT JOIN public.clientes c ON c.id = f.cliente_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pf.cuenta_bancaria_id
    WHERE pf.id = p_id AND pf.deleted_at IS NULL;

  ELSIF v_tipo = 'pago' THEN
    SELECT pp.organization_id, pp.lote_id,
           jsonb_build_object(
             'id', pp.id, 'tipo', 'pago', 'fecha', pp.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', pfa.proveedor_id,
             'moneda', pp.moneda::text, 'monto', COALESCE(pp.monto,0),
             'tipo_cambio', COALESCE(pp.tipo_cambio_usd,1),
             'monto_mxn', CASE WHEN pp.moneda::text='MXN' THEN COALESCE(pp.monto,0)
                               ELSE COALESCE(pp.monto,0)*COALESCE(pp.tipo_cambio_usd,1) END,
             'metodo_pago', pp.metodo_pago, 'referencia', pp.referencia,
             'cuenta_bancaria_id', pp.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', pp.notas, 'embarque_id', pfa.embarque_id,
             'diferencia_cambiaria_mxn', COALESCE(pp.diferencia_cambiaria_mxn,0),
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', COALESCE(pp.es_ajuste,false), 'lote_id', pp.lote_id,
             'created_by', pp.created_by, 'created_at', pp.created_at
           )
      INTO v_org_pago, v_lote, v_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
    LEFT JOIN public.proveedores pr ON pr.id = pfa.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = pp.cuenta_bancaria_id
    WHERE pp.id = p_id AND pp.deleted_at IS NULL;

  ELSIF v_tipo = 'lote' THEN
    v_lote := p_id;
    SELECT l.organization_id,
           jsonb_build_object(
             'id', l.id, 'tipo', 'lote', 'fecha', l.fecha_pago,
             'contraparte', pr.nombre, 'contraparte_id', l.proveedor_id,
             'moneda', l.moneda::text, 'monto', COALESCE(l.monto_total,0),
             'tipo_cambio', COALESCE(l.tipo_cambio_usd,1),
             'monto_mxn', CASE WHEN l.moneda::text='MXN' THEN COALESCE(l.monto_total,0)
                               ELSE COALESCE(l.monto_total,0)*COALESCE(l.tipo_cambio_usd,1) END,
             'metodo_pago', l.metodo_pago, 'referencia', l.referencia,
             'cuenta_bancaria_id', l.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', l.notas, 'embarque_id', NULL::uuid,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', l.id,
             'created_by', l.created_by, 'created_at', l.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.pagos_proveedor_lote l
    LEFT JOIN public.proveedores pr ON pr.id = l.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = l.cuenta_bancaria_id
    WHERE l.id = p_id AND l.deleted_at IS NULL;

  ELSE
    SELECT ap.organization_id,
           jsonb_build_object(
             'id', ap.id, 'tipo', 'anticipo', 'fecha', ap.fecha_anticipo,
             'contraparte', pr.nombre, 'contraparte_id', ap.proveedor_id,
             'moneda', ap.moneda::text, 'monto', COALESCE(ap.monto,0),
             'tipo_cambio', COALESCE(ap.tipo_cambio_usd,1),
             'monto_mxn', CASE WHEN ap.moneda::text='MXN' THEN COALESCE(ap.monto,0)
                               ELSE COALESCE(ap.monto,0)*COALESCE(ap.tipo_cambio_usd,1) END,
             'metodo_pago', ap.metodo_pago, 'referencia', ap.referencia,
             'cuenta_bancaria_id', ap.cuenta_bancaria_id,
             'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
             'notas', ap.notas, 'embarque_id', ap.embarque_id,
             'diferencia_cambiaria_mxn', 0::numeric,
             'estado_rep', NULL::text, 'folio_rep', NULL::text,
             'es_ajuste', false, 'lote_id', NULL::uuid,
             'estado', COALESCE(ap.estado,'Vigente'),
             'saldo_disponible', COALESCE(ap.saldo_disponible,0),
             'created_by', ap.created_by, 'created_at', ap.created_at
           )
      INTO v_org_pago, v_pago
    FROM public.anticipos_proveedor ap
    LEFT JOIN public.proveedores pr ON pr.id = ap.proveedor_id
    LEFT JOIN public.cuentas_bancarias cb ON cb.id = ap.cuenta_bancaria_id
    WHERE ap.id = p_id AND ap.deleted_at IS NULL;
  END IF;

  IF v_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_NO_ENCONTRADO: el pago no existe o fue eliminado';
  END IF;

  IF NOT v_super AND v_org_pago IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_PAGO_DETALLE_SIN_ACCESO: el pago pertenece a otra organización';
  END IF;

  SELECT jsonb_build_object(
           'id', m.id, 'fecha', m.fecha, 'concepto', m.concepto,
           'referencia', m.referencia, 'cargo', COALESCE(m.cargo,0), 'abono', COALESCE(m.abono,0),
           'saldo', m.saldo, 'estado_conciliacion', m.estado_conciliacion::text,
           'cuenta_bancaria_id', m.cuenta_bancaria_id,
           'cuenta_alias', cb.alias, 'cuenta_banco', cb.banco,
           'conciliado_por', m.conciliado_por, 'conciliado_at', m.conciliado_at
         )
    INTO v_mov
  FROM public.bbva_movimientos m
  LEFT JOIN public.cuentas_bancarias cb ON cb.id = m.cuenta_bancaria_id
  WHERE m.deleted_at IS NULL
    AND (v_super OR m.organization_id = v_org)
    AND (
      (v_tipo = 'cobro'    AND m.pago_factura_id = p_id)
      OR (v_tipo = 'pago'  AND (m.pago_proveedor_id = p_id
                                OR (v_lote IS NOT NULL AND m.pago_proveedor_lote_id = v_lote)))
      OR (v_tipo = 'lote'  AND m.pago_proveedor_lote_id = p_id)
      OR (v_tipo = 'anticipo' AND m.anticipo_proveedor_id = p_id)
    )
  ORDER BY m.fecha DESC
  LIMIT 1;

  IF v_tipo = 'cobro' THEN
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT jsonb_build_object(
               'documento_id', f.id, 'documento_tipo', 'cliente',
               'folio', NULLIF(TRIM(COALESCE(f.serie,'')||COALESCE(f.numero::text,'')),''),
               'embarque_id', pf.embarque_id,
               'moneda', f.moneda::text,
               'monto_aplicado', COALESCE(pf.monto_aplicado_factura, pf.monto, 0),
               'total', COALESCE(f.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_aplicado_factura, p2.monto, 0))
                                   FROM public.pagos_factura p2
                                   WHERE p2.factura_id = f.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.pagos_factura pf
      JOIN public.facturas f ON f.id = pf.factura_id
      WHERE pf.id = p_id AND pf.deleted_at IS NULL
    ) s;

  ELSIF v_tipo IN ('pago','lote') THEN
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', pfa.moneda::text,
               'monto_aplicado', COALESCE(pp.monto_en_moneda_factura, pp.monto, 0),
               'pago_id', pp.id,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_en_moneda_factura, p2.monto, 0))
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.pagos_proveedor pp
      JOIN public.proveedor_facturas pfa ON pfa.id = pp.proveedor_factura_id
      WHERE pp.deleted_at IS NULL
        AND ((v_lote IS NOT NULL AND pp.lote_id = v_lote) OR (v_lote IS NULL AND pp.id = p_id))
    ) s;

  ELSE
    SELECT COALESCE(jsonb_agg(x ORDER BY folio), '[]'::jsonb) INTO v_aplic
    FROM (
      SELECT COALESCE(pfa.folio_interno, pfa.folio_proveedor) AS folio,
             jsonb_build_object(
               'documento_id', pfa.id, 'documento_tipo', 'proveedor',
               'folio', COALESCE(pfa.folio_interno, pfa.folio_proveedor),
               'folio_proveedor', pfa.folio_proveedor,
               'embarque_id', pfa.embarque_id,
               'moneda', COALESCE(aa.moneda_aplicada::text, pfa.moneda::text),
               'monto_aplicado', COALESCE(aa.monto_aplicado,0),
               'fecha_aplicacion', aa.fecha_aplicacion,
               'total', COALESCE(pfa.total,0),
               'pagado', COALESCE((SELECT SUM(COALESCE(p2.monto_en_moneda_factura, p2.monto, 0))
                                   FROM public.pagos_proveedor p2
                                   WHERE p2.proveedor_factura_id = pfa.id AND p2.deleted_at IS NULL), 0)
             ) AS x
      FROM public.anticipos_aplicaciones aa
      JOIN public.proveedor_facturas pfa ON pfa.id = aa.proveedor_factura_id
      WHERE aa.anticipo_id = p_id AND aa.deleted_at IS NULL
    ) s;
  END IF;

  RETURN jsonb_build_object(
    'tipo', v_tipo,
    'pago', v_pago,
    'movimiento', v_mov,
    'aplicaciones', v_aplic
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pago_detalle(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pago_detalle(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pago_detalle(text, uuid) TO service_role;