-- AUD26: trigger real iguala base/IVA por línea con preview y payload.
BEGIN;
\i supabase/tests/rls/_helpers.sql
-- Sólo el fixture: evitar upgrades de lock al aislar recalc del guard.
LOCK TABLE public.facturas IN ACCESS EXCLUSIVE MODE;
DO $tests$
DECLARE
  fx record;
  fac uuid := gen_random_uuid();
  fac_matriz uuid := gen_random_uuid();
  cli uuid := gen_random_uuid();
  concepto uuid;
  doc public.facturas;
  caso record;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD26');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES (cli, fx.org_a, 'AUD26', 'XAXX010101000', 'aud26@example.invalid');
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision, fecha_vencimiento, moneda, estado)
  VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD26', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 'Borrador'),
         (fac_matriz, fx.org_a, cli, 'Fixture matriz', 'AUD26-MATRIZ', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 'Borrador');
  PERFORM pg_temp.as_user(fx.admin_a);
  INSERT INTO public.conceptos_factura(factura_id, organization_id, descripcion, cantidad, precio_unitario, tipo_iva, tasa_iva_aplicada)
  VALUES (fac, fx.org_a, 'Base .033', .3, .11, 'gravado_16', .16);
  SELECT * INTO doc FROM public.facturas WHERE id = fac;
  PERFORM pg_temp.assert(doc.subtotal = .03 AND doc.iva = 0 AND doc.total = .03, 'AUD26: .3*.11 base.03 IVA0 total.03');
  INSERT INTO public.conceptos_factura(factura_id, organization_id, descripcion, cantidad, precio_unitario, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva)
  VALUES (fac, fx.org_a, 'IVA8', 1, 100, 'gravado_8', .08, .01, .02),
         (fac, fx.org_a, 'Tasa0', 1, 10, 'tasa_0', 0, 0, 0),
         (fac, fx.org_a, 'Exento', 1, 20, 'exento', 0, 0, 0),
         (fac, fx.org_a, 'No objeto', 1, 30, 'no_objeto', NULL, 0, 0);
  SELECT * INTO doc FROM public.facturas WHERE id = fac;
  PERFORM pg_temp.assert(doc.subtotal = 160.03 AND doc.iva = 8 AND doc.ret_isr = 1 AND doc.ret_iva = 2 AND doc.total = 165.03,
    'AUD26: tratamientos y retenciones deben conservarse');
  UPDATE public.conceptos_factura SET deleted_at = now() WHERE factura_id = fac;
  PERFORM public.recalc_factura_totales(fac);
  SELECT * INTO doc FROM public.facturas WHERE id = fac;
  PERFORM pg_temp.assert(doc.subtotal = 0 AND doc.iva = 0 AND doc.ret_isr = 0 AND doc.ret_iva = 0 AND doc.total = 0,
    'AUD26: sin conceptos vivos debe mantener cero');
  -- Importes esperados manuales y acumulados: cada caso pasa por ambos caminos.
  FOR caso IN
    SELECT * FROM (VALUES
      (1, 'IVA8 NULL', 1::numeric, 100::numeric, 'gravado_8', NULL::numeric, 100::numeric, 8::numeric, 108::numeric),
      (2, 'IVA16 NULL', 1, 100, 'gravado_16', NULL, 200, 24, 224),
      (3, 'Exento NULL', 1, 100, 'exento', NULL, 300, 24, 324),
      (4, 'Tasa0 NULL', 1, 100, 'tasa_0', NULL, 400, 24, 424),
      (5, 'No objeto NULL', 1, 100, 'no_objeto', NULL, 500, 24, 524),
      (6, 'Cero explícito sobre IVA16', 1, 100, 'gravado_16', 0, 600, 24, 624),
      (7, 'Tasa explícita sobre IVA8', 1, 100, 'gravado_8', .16, 700, 40, 740),
      (8, 'IVA8 explícito sobre IVA16', 1, 100, 'gravado_16', .08, 800, 48, 848),
      (9, 'IVA8 base .0625', .0625, 1, 'gravado_8', NULL, 800.06, 48, 848.06)
    ) AS matriz(orden, descripcion, cantidad, precio, tipo, tasa, subtotal, iva, total)
    ORDER BY orden
  LOOP
    concepto := gen_random_uuid();
    INSERT INTO public.conceptos_factura(
      id, factura_id, organization_id, descripcion, cantidad, precio_unitario,
      tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva
    ) VALUES (
      concepto, fac_matriz, fx.org_a, caso.descripcion, caso.cantidad, caso.precio,
      caso.tipo, caso.tasa, 0, 0
    );
    PERFORM pg_temp.assert(EXISTS (
      SELECT 1 FROM public.conceptos_factura c
      WHERE c.id = concepto AND c.tipo_iva = caso.tipo
        AND c.tasa_iva_aplicada IS NOT DISTINCT FROM caso.tasa
    ), 'AUD26: preservar la tasa capturada de ' || caso.descripcion);
    SELECT * INTO doc FROM public.facturas WHERE id = fac_matriz;
    PERFORM pg_temp.assert(
      doc.subtotal = caso.subtotal AND doc.iva = caso.iva
        AND doc.ret_isr = 0 AND doc.ret_iva = 0 AND doc.total = caso.total,
      'AUD26: trigger normal de ' || caso.descripcion
    );

    -- Sólo en esta transacción del fixture: el guard no debe corregir recalc.
    PERFORM pg_temp.as_postgres();
    ALTER TABLE public.facturas DISABLE TRIGGER trg_facturas_totales_guard;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM public.recalc_factura_totales(fac_matriz);
    SELECT * INTO doc FROM public.facturas WHERE id = fac_matriz;
    PERFORM pg_temp.assert(
      doc.subtotal = caso.subtotal AND doc.iva = caso.iva
        AND doc.ret_isr = 0 AND doc.ret_iva = 0 AND doc.total = caso.total,
      'AUD26: recalc aislado de ' || caso.descripcion
    );
    PERFORM pg_temp.as_postgres();
    ALTER TABLE public.facturas ENABLE TRIGGER trg_facturas_totales_guard;
    PERFORM pg_temp.as_user(fx.admin_a);
    RAISE NOTICE 'AUD26: % correcto por trigger y recalc aislado', caso.descripcion;
  END LOOP;
END;
$tests$;
ROLLBACK;
