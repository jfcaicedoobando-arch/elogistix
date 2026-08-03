-- Conciliación automática CxP: recalcula saldo del proveedor y estatus de factura
-- a partir de los pagos y sus movimientos de tesorería registrados.
CREATE OR REPLACE FUNCTION public.conciliar_tesoreria_proveedor(
  p_proveedor_id uuid DEFAULT NULL,
  p_factura_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_revisadas int := 0;
  v_actualizadas int := 0;
  v_facturas jsonb := '[]'::jsonb;
  v_incidencias jsonb := '[]'::jsonb;
  v_proveedores jsonb := '[]'::jsonb;
  r record;
  v_estado_antes text;
  v_captura_antes text;
BEGIN
  IF p_proveedor_id IS NULL AND p_factura_id IS NULL THEN
    RAISE EXCEPTION 'LC_CONCILIACION_SIN_ALCANCE: indica un proveedor o una factura'
      USING ERRCODE = 'P0001';
  END IF;

  v_org := public.current_user_org_id();
  PERFORM public._assert_writer(v_org);

  -- 1) Recalcular estado/etapa de captura de cada factura en el alcance.
  FOR r IN
    SELECT pf.id, pf.estado::text AS estado, pf.estado_captura
    FROM public.proveedor_facturas pf
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
  LOOP
    v_revisadas := v_revisadas + 1;
    v_estado_antes := r.estado;
    v_captura_antes := r.estado_captura;

    PERFORM public._recalc_estado_proveedor_factura(r.id);

    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.id = r.id
        AND (pf.estado::text IS DISTINCT FROM v_estado_antes
             OR pf.estado_captura IS DISTINCT FROM v_captura_antes)
    ) THEN
      v_actualizadas := v_actualizadas + 1;
    END IF;
  END LOOP;

  -- 2) Detalle por factura con los importes recalculados.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'folio'), '[]'::jsonb) INTO v_facturas
  FROM (
    SELECT jsonb_build_object(
             'factura_id', pf.id,
             'folio', COALESCE(NULLIF(pf.folio_proveedor,''), pf.folio_interno),
             'moneda', pf.moneda::text,
             'total', ROUND(s.total, 2),
             'pagado', ROUND(s.pagado, 2),
             'notas_credito', ROUND(s.notas_credito_aplicadas, 2),
             'saldo', ROUND(s.saldo, 2),
             'estado', pf.estado::text,
             'pagos', (SELECT count(*) FROM public.pagos_proveedor pp
                        WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),
             'movimientos', (SELECT count(*) FROM public.bbva_movimientos bm
                              JOIN public.pagos_proveedor pp2 ON pp2.id = bm.pago_proveedor_id
                              WHERE pp2.proveedor_factura_id = pf.id
                                AND pp2.deleted_at IS NULL
                                AND bm.deleted_at IS NULL)
           ) AS x
    FROM public.proveedor_facturas pf
    JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
  ) q;

  -- 3) Incidencias: pagos sin movimiento de tesorería o con importe distinto.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'fecha_pago'), '[]'::jsonb) INTO v_incidencias
  FROM (
    SELECT jsonb_build_object(
             'pago_id', pp.id,
             'factura_id', pp.proveedor_factura_id,
             'folio', COALESCE(NULLIF(pf.folio_proveedor,''), pf.folio_interno),
             'fecha_pago', pp.fecha_pago,
             'monto', ROUND(pp.monto, 2),
             'moneda', pp.moneda::text,
             'monto_esperado_mxn', ROUND(
               CASE WHEN pp.moneda::text = 'MXN' THEN pp.monto
                    WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN pp.monto * pp.tipo_cambio_usd
                    ELSE pp.monto END, 2),
             'cargo_mxn', ROUND(COALESCE(m.cargo, 0), 2),
             'tipo', CASE WHEN m.id IS NULL THEN 'sin_movimiento' ELSE 'descuadre' END
           ) AS x, pp.fecha_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    LEFT JOIN public.bbva_movimientos m
           ON m.pago_proveedor_id = pp.id AND m.deleted_at IS NULL
    WHERE pf.organization_id = v_org
      AND pp.deleted_at IS NULL
      AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
      AND (
        (m.id IS NULL AND pp.cuenta_bancaria_id IS NOT NULL)
        OR (m.id IS NOT NULL AND abs(COALESCE(m.cargo,0) - (
             CASE WHEN pp.moneda::text = 'MXN' THEN pp.monto
                  WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN pp.monto * pp.tipo_cambio_usd
                  ELSE pp.monto END)) > 0.01)
      )
  ) q2;

  -- 4) Saldo pendiente del proveedor por moneda (facturas vivas y no canceladas).
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'moneda'), '[]'::jsonb) INTO v_proveedores
  FROM (
    SELECT jsonb_build_object(
             'proveedor_id', pf.proveedor_id,
             'moneda', pf.moneda::text,
             'saldo_pendiente', ROUND(SUM(GREATEST(s.saldo, 0)), 2),
             'facturas_abiertas', COUNT(*) FILTER (WHERE s.saldo > 0.01)
           ) AS x
    FROM public.proveedor_facturas pf
    JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Cancelada','Borrador')
      AND (p_proveedor_id IS NOT NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
    GROUP BY pf.proveedor_id, pf.moneda
  ) q3;

  RETURN jsonb_build_object(
    'facturas_revisadas', v_revisadas,
    'facturas_actualizadas', v_actualizadas,
    'facturas', v_facturas,
    'incidencias', v_incidencias,
    'proveedores', v_proveedores,
    'conciliado_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) TO service_role;