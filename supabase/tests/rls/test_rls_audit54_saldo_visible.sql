-- AUD54 extensión: deuda documentada de un centavo es visible en todos los lectores.
-- Fixtures ficticios en PostgreSQL efímero. No se modifica ningún histórico real.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  cli uuid := gen_random_uuid();
  fac uuid := gen_random_uuid();
  legacy uuid := gen_random_uuid();
  cancelada uuid := gen_random_uuid();
  pue uuid := gen_random_uuid();
  pue_pago uuid;
  datos jsonb;
  antes timestamptz;
  err text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD54-visible');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'AUD54 visible', 'XAXX010101000', 'aud54visible@example.invalid');
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero,
    fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
  VALUES
    (fac, fx.org_a, cli, 'Fixture', 'AUD54-PPD-cent', CURRENT_DATE - 2, CURRENT_DATE - 1, 'MXN', 1, 1, .16, 1.16, 'Emitida', 'PPD'),
    (legacy, fx.org_a, cli, 'Fixture', 'AUD54-legacy-no-evidence', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1, 1, .16, 1.16, 'Pagada', 'PUE'),
    (cancelada, fx.org_a, cli, 'Fixture', 'AUD54-cancelada', CURRENT_DATE - 2, CURRENT_DATE - 1, 'MXN', 1, 1, .16, 1.16, 'Cancelada', 'PPD'),
    (pue, fx.org_a, cli, 'Fixture', 'AUD54-legacy-with-cent', CURRENT_DATE - 2, CURRENT_DATE - 1, 'MXN', 1, 1, .16, 1.16, 'Emitida', 'PPD');
  PERFORM pg_temp.as_user(fx.admin_a);
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago)
  VALUES (fac, fx.org_a, CURRENT_DATE, 1.15, 'MXN', 1, 'Transferencia');
  PERFORM pg_temp.assert((SELECT estado = 'Parcialmente pagada' FROM public.facturas WHERE id = fac),
    'AUD54: PPD con centavo real no se marca Pagada');
  PERFORM pg_temp.assert(public.saldo_factura(fac) = .01, 'AUD54: PPD conserva deuda exacta');
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago)
  VALUES (pue, fx.org_a, CURRENT_DATE, 1.15, 'MXN', 1, 'Transferencia') RETURNING id INTO pue_pago;

  -- Simular exclusivamente en el fixture un estado histórico permitido por la versión anterior.
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('app.recalc_estado_factura', '1', true);
  UPDATE public.facturas SET estado = 'Pagada', metodo_pago = 'PUE' WHERE id = pue;
  PERFORM set_config('app.recalc_estado_factura', '', true);
  SELECT updated_at INTO antes FROM public.facturas WHERE id = pue;
  PERFORM pg_temp.as_user(fx.admin_a);

  PERFORM pg_temp.assert((SELECT COUNT(*) = 2 FROM public.cartera_pendiente() WHERE cliente_id = cli),
    'AUD54: cartera muestra PPD parcial y Pagada documentada con residual');
  PERFORM pg_temp.assert(public.cartera_pendiente_total() = (SELECT COUNT(*) FROM public.cartera_pendiente()),
    'AUD54: contador cartera coincide con listado sin truncamiento');
  PERFORM pg_temp.assert((SELECT SUM(saldo) = .02 FROM public.cartera_pendiente() WHERE cliente_id = cli),
    'AUD54: cartera conserva ambos centavos sin condonar');
  PERFORM pg_temp.assert((SELECT COUNT(*) = 2 FROM public.cobranza_listado(cli)),
    'AUD54: cobranza incluye sólo las dos deudas documentadas');
  PERFORM pg_temp.assert((SELECT COUNT(*) = 2 FROM public.cobranza_listado(cli, 'MXN', NULL, 'Vencida')),
    'AUD54: el centavo tiene estatus Vencida, no Pagada/Sin saldo');
  datos := public.cobranza_agregados(cli);
  PERFORM pg_temp.assert((datos->>'total_mxn')::numeric = .02 AND (datos->>'facturas_con_saldo')::int = 2
    AND (datos->>'facturas_vencidas')::int = 2,
    'AUD54: KPI cobranza coincide con sus filas y no reabre legado sin evidencia');
  PERFORM pg_temp.assert((SELECT saldo_total = .02 AND num_facturas = 2
    FROM public.cxc_aging_clientes() WHERE cliente_id = cli),
    'AUD54: aging CxC incluye los dos centavos y excluye Pagada sin pagos');
  -- Estado de cuenta conserva su contrato histórico: muestra saldo canónico incluso sin pagos.
  datos := public.estado_cuenta_agregados(ARRAY[cli]);
  PERFORM pg_temp.assert((datos->>'adeudado_mxn')::numeric = 1.18 AND (datos->>'facturas_adeudadas')::int = 3,
    'AUD54: estado de cuenta preserva histórico ya visible y cuenta ambos centavos');
  PERFORM pg_temp.assert((datos->>'vencido_mxn')::numeric = .02 AND (datos->>'facturas_vencidas')::int = 2,
    'AUD54: estado de cuenta vencido coincide con cobranza y excluye cancelada');
  PERFORM pg_temp.assert(public.saldo_factura(cancelada) = 0, 'AUD54: Cancelada mantiene saldo terminal cero');
  PERFORM pg_temp.assert((SELECT estado = 'Pagada' AND updated_at = antes FROM public.facturas WHERE id = pue),
    'AUD54: lecturas no reescriben estado ni updated_at históricos');
  PERFORM pg_temp.assert((SELECT estado = 'Pagada' FROM public.facturas WHERE id = legacy)
    AND NOT EXISTS (SELECT 1 FROM public.pagos_factura WHERE factura_id = legacy),
    'AUD54: no crear pagos ni reabrir estado de Pagada sin evidencia');

  err := NULL;
  BEGIN
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago)
    VALUES (pue, fx.org_a, CURRENT_DATE, .01, 'MXN', 1, 'Transferencia');
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_EXHIBICION_UNICA:%', false),
    'AUD54: PUE histórico se revisa, no admite una segunda exhibición');
  PERFORM pg_temp.assert(public.saldo_factura(pue) = .01 AND
    (SELECT monto = 1.15 AND monto_aplicado_factura = 1.15 FROM public.pagos_factura WHERE id = pue_pago),
    'AUD54: rechazo no compensa ni oculta centavo del pago previo');

  -- PPD sí permite cobrar el centavo restante por la vía normal.
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago)
  VALUES (fac, fx.org_a, CURRENT_DATE, .01, 'MXN', 1, 'Transferencia');
  PERFORM pg_temp.assert(public.saldo_factura(fac) = 0 AND
    (SELECT estado = 'Pagada' FROM public.facturas WHERE id = fac), 'AUD54: PPD se liquida al cobrar todo');
  PERFORM pg_temp.assert((public.cobranza_agregados(cli)->>'total_mxn')::numeric = .01,
    'AUD54: queda exactamente centavo PUE documentado en cobranza');

  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.cobranza_listado(cli)), 'AUD54: listado no cruza tenant');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.cartera_pendiente() WHERE cliente_id = cli), 'AUD54: cartera mantiene RLS');
END;
$tests$;
ROLLBACK;
