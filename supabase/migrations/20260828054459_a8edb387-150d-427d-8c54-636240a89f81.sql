-- =========================================================================
-- Ola E1 · Bloque 2 — Integridad financiera (N-F3, C1-res, N22, N24)
-- =========================================================================

-- N-F3: sin T/C válido, la factura extranjera sin vínculo NO se compara contra
-- el umbral asumiendo 1:1 — se bloquea la aprobación.
CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid, p_justificacion text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_suma_cantidades numeric(18,4);
  v_tolerancia numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
  v_total_mxn numeric(18,4);
  v_umbral numeric;
  v_c record;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  v_tolerancia := GREATEST(0.01, 0.005 * COALESCE(v_suma_cantidades,0));

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > v_tolerancia THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: % (tolerancia: %)',
      to_char(v_suma_conceptos,          'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,              'FM999,999,999,990.00'),
      to_char(v_tolerancia,              'FM999,999,999,990.00');
  END IF;

  -- Tope de sobrecosto POR CONCEPTO, sumando todas las facturas vivas ligadas
  -- a ese concepto y normalizando ambos lados a MXN.
  FOR v_c IN
    SELECT cc.id,
           cc.concepto,
           public.a_mxn_doc(cc.monto, cc.moneda::text, v_row.fecha_emision,
                            NULL, emb.tipo_cambio_usd) AS comprometido_mxn,
           (
             SELECT COALESCE(SUM(
                      public.a_mxn_doc(p2.monto * COALESCE(NULLIF(p2.cantidad,0),1),
                                       pf2.moneda::text, pf2.fecha_emision,
                                       pf2.tipo_cambio_usd, emb.tipo_cambio_usd)
                    ), 0)
               FROM public.proveedor_facturas_conceptos p2
               JOIN public.proveedor_facturas pf2 ON pf2.id = p2.proveedor_factura_id
              WHERE p2.concepto_costo_id = cc.id
                AND pf2.deleted_at IS NULL
                AND pf2.estado <> 'Cancelada'::public.estado_proveedor_factura
                AND COALESCE(pf2.estado_aprobacion::text, 'pendiente') <> 'rechazada'
           ) AS facturado_mxn
      FROM public.proveedor_facturas_conceptos pfc
      JOIN public.conceptos_costo cc
        ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
      LEFT JOIN public.embarques emb ON emb.id = cc.embarque_id
     WHERE pfc.proveedor_factura_id = p_factura_id
       AND pfc.concepto_costo_id IS NOT NULL
     GROUP BY cc.id, cc.concepto, cc.monto, cc.moneda, emb.tipo_cambio_usd
  LOOP
    IF v_c.comprometido_mxn IS NULL THEN
      RAISE WARNING 'LC_CXP_SIN_TC: el concepto "%" no tiene tipo de cambio para comparar; se omite el control de sobrecosto.', v_c.concepto;
      CONTINUE;
    END IF;

    IF v_c.facturado_mxn - v_c.comprometido_mxn > 0.02
       AND v_c.comprometido_mxn > 0
       AND (v_c.facturado_mxn - v_c.comprometido_mxn) > v_c.comprometido_mxn * 0.05 THEN
      RAISE EXCEPTION 'LC_CXP_SOBRECOSTO: el concepto "%" ya tiene facturado % MXN contra % MXN comprometidos (incluyendo otras facturas del mismo costo). Revisa la vinculación antes de aprobar.',
        v_c.concepto,
        to_char(v_c.facturado_mxn,    'FM999,999,999,990.00'),
        to_char(v_c.comprometido_mxn, 'FM999,999,999,990.00');
    ELSIF v_c.facturado_mxn - v_c.comprometido_mxn > 0.02 THEN
      RAISE WARNING 'LC_CXP_SOBRECOSTO: el concepto "%" excede lo comprometido en % MXN (<= 5%%, se aprueba con advertencia).',
        v_c.concepto,
        to_char(v_c.facturado_mxn - v_c.comprometido_mxn, 'FM999,999,999,990.00');
    END IF;
  END LOOP;

  IF v_row.embarque_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.proveedor_facturas_conceptos
        WHERE proveedor_factura_id = p_factura_id
          AND concepto_costo_id IS NOT NULL
     )
  THEN
    -- Ola E1 · N-F3: antes `COALESCE(NULLIF(tipo_cambio_usd,0), 1)` valuaba una
    -- factura en USD como si fuera MXN y saltaba el umbral sin justificación.
    IF v_row.moneda = 'MXN'::public.moneda THEN
      v_total_mxn := COALESCE(v_row.total,0);
    ELSE
      IF COALESCE(NULLIF(v_row.tipo_cambio_usd,0), 0) <= 0 THEN
        RAISE EXCEPTION 'LC_CXP_TC_REQUERIDO: la factura está en % y no tiene tipo de cambio capturado; registra el T/C del DOF de la fecha de la factura antes de aprobar.',
          v_row.moneda;
      END IF;
      v_total_mxn := COALESCE(v_row.total,0) * v_row.tipo_cambio_usd;
    END IF;

    v_umbral := public.cxp_umbral_sin_vinculo(v_row.organization_id);

    IF v_total_mxn > v_umbral THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO_MONTO: La factura por % MXN no está ligada a un embarque ni a costos acordados y excede el umbral autorizado (%). Vincúlala al embarque o a sus conceptos de costo antes de aprobar.',
        to_char(v_total_mxn, 'FM999,999,999,990.00'),
        to_char(v_umbral,    'FM999,999,999,990.00');
    END IF;

    IF length(COALESCE(btrim(p_justificacion), '')) < 10 THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO: Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para aprobarla.';
    END IF;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

-- C1-res: el estado de cuenta usa el canon multimoneda de notas de crédito.
CREATE OR REPLACE FUNCTION public.facturas_cartera_cliente(p_cliente_id uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, organization_id uuid, numero text, serie text, folio text, cliente_id uuid, cliente_nombre text, total numeric, saldo numeric, moneda text, estado text, fecha_emision date, fecha_vencimiento date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_uid uuid := auth.uid();
  v_caller_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = p_cliente_id AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN RETURN; END IF;

  -- Fail-closed para usuarios finales de otra organización.
  IF v_uid IS NOT NULL
     AND COALESCE(auth.role()::text, '') <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    v_caller_org := public.current_user_org_id();
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.organization_id,
         f.numero::text,
         f.serie::text,
         f.folio_fiscal::text,
         f.cliente_id,
         f.cliente_nombre::text,
         COALESCE(f.total, 0)::numeric,
         CASE
           WHEN f.estado::text = 'Pagada' THEN 0::numeric
           ELSE (COALESCE(f.total, 0)
             - COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                          WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
             -- Ola E1 · C1-res: antes `SUM(nc.monto)` en crudo mezclaba monedas.
             - public._nc_aplicadas_moneda_factura(f.id))::numeric
         END AS saldo,
         f.moneda::text,
         f.estado::text,
         f.fecha_emision,
         f.fecha_vencimiento
  FROM public.facturas f
  WHERE f.cliente_id = p_cliente_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Borrador', 'Cancelada', 'Sustituida')
    AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
    AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ORDER BY f.fecha_emision;
END;
$function$;

-- N22: un movimiento bancario es cargo O abono, nunca ambos ni negativo.
ALTER TABLE public.bbva_movimientos
  DROP CONSTRAINT IF EXISTS bbva_movimientos_cargo_abono_check;
ALTER TABLE public.bbva_movimientos
  ADD CONSTRAINT bbva_movimientos_cargo_abono_check
  CHECK (
    cargo >= 0 AND abono >= 0
    AND ((cargo > 0)::int + (abono > 0)::int) <= 1
  );

-- N24: el saldo disponible de un anticipo vive entre 0 y el monto original.
ALTER TABLE public.anticipos_proveedor
  DROP CONSTRAINT IF EXISTS anticipos_proveedor_saldo_rango_check;
ALTER TABLE public.anticipos_proveedor
  ADD CONSTRAINT anticipos_proveedor_saldo_rango_check
  CHECK (saldo_disponible IS NULL OR (saldo_disponible >= 0 AND saldo_disponible <= monto + 0.01));
