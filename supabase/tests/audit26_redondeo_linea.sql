-- AUD26: trigger real iguala base/IVA por línea con preview y payload.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  fac uuid := gen_random_uuid();
  cli uuid := gen_random_uuid();
  doc public.facturas;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD26');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES (cli, fx.org_a, 'AUD26', 'XAXX010101000', 'aud26@example.invalid');
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision, fecha_vencimiento, moneda, estado)
  VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD26', CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 'Borrador');
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
END;
$tests$;
ROLLBACK;
