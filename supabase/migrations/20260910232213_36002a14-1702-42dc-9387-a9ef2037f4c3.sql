-- Ola v17 · Candado: chequeo diario de consistencia (sólo avisa, no corrige).
CREATE OR REPLACE FUNCTION public.auditar_consistencia_cobranza()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado integer := 0;
  v_sin_espejo integer := 0;
  v_dia text := to_char((now() AT TIME ZONE 'America/Mexico_City')::date, 'YYYY-MM-DD');
BEGIN
  -- 1) Estado de factura incoherente con su saldo canónico.
  WITH d AS (
    SELECT f.id, f.numero, f.organization_id, f.estado::text AS estado,
           public._saldo_factura_calc(f.id) AS saldo,
           COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                      WHERE p.factura_id = f.id AND p.deleted_at IS NULL
                        AND NOT public.pago_rep_anulado(p.estado_rep)), 0) AS pagado
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Parcialmente pagada','Vencida','Pagada')
  ), inc AS (
    SELECT d.*, CASE
        WHEN d.saldo <= 0.01 THEN 'Pagada'
        WHEN d.pagado > 0 THEN 'Parcialmente pagada'
        ELSE d.estado
      END AS esperado
    FROM d
  )
  INSERT INTO public.alertas_sistema (severity, source, message, payload, dedupe_key)
  SELECT 'warning', 'auditoria_cobranza',
         'Factura ' || COALESCE(i.numero, i.id::text) || ': estado ' || i.estado
           || ' no coincide con su saldo (' || round(i.saldo, 2) || ')',
         jsonb_build_object('factura_id', i.id, 'organization_id', i.organization_id,
                            'estado', i.estado, 'estado_esperado', i.esperado,
                            'saldo', i.saldo, 'pagado', i.pagado),
         'cobranza-estado-' || i.id::text || '-' || v_dia
  FROM inc i
  WHERE i.esperado <> i.estado
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_estado = ROW_COUNT;

  -- 2) Cobro vigente con cuenta bancaria pero sin movimiento en el banco.
  INSERT INTO public.alertas_sistema (severity, source, message, payload, dedupe_key)
  SELECT 'warning', 'auditoria_cobranza',
         'Cobro sin movimiento bancario (factura ' || COALESCE(f.numero, '') || ')',
         jsonb_build_object('pago_factura_id', p.id, 'factura_id', p.factura_id,
                            'organization_id', p.organization_id,
                            'cuenta_bancaria_id', p.cuenta_bancaria_id,
                            'monto', p.monto, 'moneda', p.moneda::text),
         'cobranza-sin-espejo-' || p.id::text || '-' || v_dia
  FROM public.pagos_factura p
  JOIN public.facturas f ON f.id = p.factura_id
  WHERE p.deleted_at IS NULL
    AND p.cuenta_bancaria_id IS NOT NULL
    AND NOT public.pago_rep_anulado(p.estado_rep)
    AND p.lote_id IS NULL
    AND p.fecha_pago >= (now() AT TIME ZONE 'America/Mexico_City')::date - INTERVAL '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.bbva_movimientos m
       WHERE m.deleted_at IS NULL
         AND (m.pago_factura_id = p.id OR m.hash_dedupe = 'cobro-' || p.id::text)
    )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_sin_espejo = ROW_COUNT;

  RETURN jsonb_build_object('estados_incoherentes', v_estado, 'cobros_sin_espejo', v_sin_espejo);
END;
$function$;

REVOKE ALL ON FUNCTION public.auditar_consistencia_cobranza() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auditar_consistencia_cobranza() TO service_role;

SELECT cron.schedule(
  'auditar_consistencia_cobranza_diario',
  '35 6 * * *',
  $$ SELECT public.auditar_consistencia_cobranza(); $$
);
