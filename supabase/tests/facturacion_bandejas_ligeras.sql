BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $fixture$
DECLARE
  fx record;
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  rep_fac_a uuid := gen_random_uuid();
  rep_fac_b uuid := gen_random_uuid();
  puente uuid := gen_random_uuid();
  hoy date := public.fecha_negocio_mx();
  rep public.v_reps_historico%ROWTYPE;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('FACTURACION-BANDEJAS');
  INSERT INTO public.clientes(id, organization_id, nombre, email) VALUES
    (cli_a, fx.org_a, 'Cliente REP A', 'rep-a@example.invalid'),
    (cli_b, fx.org_b, 'Cliente REP B', 'rep-b@example.invalid');
  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, eta, facturado_historico, deleted_at)
  SELECT fx.org_a, cli_a, 'ELHCF' || n, 'Marítimo', 'Importación', 'Arribo',
    CASE n WHEN 7 THEN hoy + 4 WHEN 8 THEN DATE '2026-03-31' ELSE hoy END,
    n = 10, CASE WHEN n = 9 THEN now() END
  FROM generate_series(1, 10) n;
  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, eta)
  VALUES (fx.org_b, cli_b, 'ELHCF20', 'Marítimo', 'Importación', 'Arribo', hoy);

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero, expediente, factura_pdf_url,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, uuid_fiscal)
  VALUES
    (rep_fac_a, fx.org_a, cli_a, 'Cliente REP A', 'F-REP-A', 'ELHCF98', NULL,
      hoy - 35, hoy + 10, 'MXN', 1, 6000, 0, 6000, 'Emitida', gen_random_uuid()::text),
    (rep_fac_b, fx.org_b, cli_b, 'Cliente REP B', 'F-REP-B', 'ELHCF98', NULL,
      hoy - 35, hoy + 10, 'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text),
    (gen_random_uuid(), fx.org_a, cli_a, 'Cliente A', 'F-HUECO-LEGACY', 'ELHCF2', 'https://example.invalid/a.pdf',
      hoy - 10, hoy + 10, 'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text),
    (puente, fx.org_a, cli_a, 'Cliente A', 'F-HUECO-PUENTE', 'ELHCF99', NULL,
      hoy - 10, hoy + 10, 'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text),
    (gen_random_uuid(), fx.org_a, cli_a, 'Cliente A', 'F-HUECO-PENDIENTE', 'ELHCF4', 'https://example.invalid/b.pdf',
      hoy - 10, hoy + 10, 'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text),
    (gen_random_uuid(), fx.org_a, cli_a, 'Cliente A', 'F-HUECO-CANCELADA', 'ELHCF6', 'https://example.invalid/c.pdf',
      hoy - 10, hoy + 10, 'MXN', 1, 100, 0, 100, 'Cancelada', gen_random_uuid()::text);
  INSERT INTO public.factura_embarques (organization_id, factura_id, embarque_id, activa)
    SELECT fx.org_a, puente, id, true FROM public.embarques
    WHERE organization_id = fx.org_a AND expediente = 'ELHCF3';
  INSERT INTO public.conceptos_venta
    (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, estado_facturacion, origen)
    SELECT id, 'Flete', 1, 100, 'MXN', 100, fx.org_a,
      CASE expediente WHEN 'ELHCF4' THEN 'pendiente' ELSE 'facturado' END, 'manual'
    FROM public.embarques WHERE organization_id = fx.org_a AND expediente IN ('ELHCF4', 'ELHCF5');

  INSERT INTO public.pagos_factura
    (factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia)
    SELECT rep_fac_a, fx.org_a, hoy - 4, 1, 'MXN', 1, 1, 'Transferencia', 'BANDEJAS-REP-' || n
    FROM generate_series(1, 525) n;
  UPDATE public.pagos_factura p
    SET estado_rep = 'Timbrado', serie_rep = 'R',
        folio_rep = split_part(p.referencia, '-', 3)::integer,
        uuid_rep = CASE WHEN p.referencia = 'BANDEJAS-REP-1' THEN 'REP-ANTIGUO-LITERAL' ELSE gen_random_uuid()::text END,
        timbrado_rep_en = now() + split_part(p.referencia, '-', 3)::integer * INTERVAL '1 second'
    WHERE p.factura_id = rep_fac_a;
  INSERT INTO public.pagos_factura
    (factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago)
  VALUES (rep_fac_b, fx.org_b, hoy - 4, 1, 'MXN', 1, 1, 'Transferencia');
  UPDATE public.pagos_factura
    SET estado_rep = 'Timbrado', serie_rep = 'R', folio_rep = 1,
        uuid_rep = 'REP-OTRA-ORGANIZACION', timbrado_rep_en = now()
    WHERE factura_id = rep_fac_b;

  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert(public.hueco_facturacion_count() = 3,
    'Hueco A: vacío, pendiente sobre CFDI vivo y CFDI cancelado, con ventana y bajas aplicadas');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.v_reps_historico) = 525,
    'Histórico A incluye todos los pagos timbrados');
  SELECT * INTO STRICT rep FROM public.v_reps_historico WHERE busqueda ILIKE '%rep-antiguo-literal%';
  PERFORM pg_temp.assert(rep.folio_rep = 'R-1' AND rep.factura_numero = 'F-REP-A',
    'Busca y devuelve el REP histórico por UUID');
  PERFORM pg_temp.assert((
    SELECT folio_rep = 'R-25' FROM public.v_reps_historico
    ORDER BY timbrado_rep_en DESC NULLS LAST, id OFFSET 500 LIMIT 1
  ) IS TRUE, 'Orden estable en una página posterior al límite de 500');

  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert(public.hueco_facturacion_count() = 1, 'Hueco B aislado');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.v_reps_historico) = 1, 'Histórico B aislado');
END;
$fixture$;

ROLLBACK;
