-- Auditoria GUI 02. Regresion conductual en PostgreSQL efimero, nunca Live.
-- Ejercita triggers reales, saldo canonico, creditos y reversos, sin backfill.
BEGIN;

\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.fixture_liquidacion_costo(
  p_org uuid, p_prov uuid, p_cat uuid, p_moneda public.moneda,
  p_total numeric, p_costo numeric DEFAULT NULL
) RETURNS TABLE(costo_id uuid, factura_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_cliente uuid;
  v_embarque uuid;
  v_costo uuid;
  v_factura uuid;
BEGIN
  INSERT INTO public.clientes(organization_id, nombre, email)
  VALUES (p_org, 'AUD02 CLIENTE', 'audit02@test.local') RETURNING id INTO v_cliente;
  INSERT INTO public.embarques(organization_id, cliente_id, expediente, modo, tipo)
  VALUES (p_org, v_cliente, 'AUD02-' || gen_random_uuid(), 'Marítimo', 'Importación')
  RETURNING id INTO v_embarque;
  INSERT INTO public.conceptos_costo(
    organization_id, embarque_id, proveedor_id, concepto, monto, moneda,
    tasa_iva_aplicada, origen
  ) VALUES (p_org, v_embarque, p_prov, 'AUD02 Flete', COALESCE(p_costo, p_total),
            p_moneda, 0, 'manual') RETURNING id INTO v_costo;
  INSERT INTO public.proveedor_facturas(
    organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    embarque_id, fecha_emision, moneda, tipo_cambio_usd, subtotal, total,
    estado, estado_aprobacion
  ) VALUES (p_org, p_prov, p_cat, 'AUD02-' || gen_random_uuid(), v_embarque,
            public.fecha_negocio_mx() - 3, p_moneda, 20, p_total, p_total,
            'Vigente', 'aprobada') RETURNING id INTO v_factura;
  INSERT INTO public.proveedor_facturas_conceptos(
    organization_id, proveedor_factura_id, concepto_costo_id, descripcion, monto
  ) VALUES (p_org, v_factura, v_costo, 'AUD02 Flete', p_total);
  RETURN QUERY SELECT v_costo, v_factura;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_liquidacion_costo(
  p_costo uuid, p_estado text, p_caso text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_estado text;
  v_fecha date;
BEGIN
  SELECT estado_liquidacion::text, fecha_pago INTO v_estado, v_fecha
  FROM public.conceptos_costo WHERE id = p_costo;
  IF v_estado IS DISTINCT FROM p_estado THEN
    RAISE EXCEPTION 'AUD02 %: esperaba %, obtuvo %', p_caso, p_estado, v_estado;
  END IF;
  IF p_estado = 'Pendiente' AND v_fecha IS NOT NULL THEN
    RAISE EXCEPTION 'AUD02 %: un costo Pendiente no debe conservar fecha_pago %', p_caso, v_fecha;
  END IF;
END;
$$;

DO $tests$
DECLARE
  v_org uuid := gen_random_uuid();
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_fixture record;
  v_segunda uuid;
  v_pago uuid;
  v_nc uuid;
  v_saldo numeric;
  v_fecha date;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'AUD02 LIQUIDACION');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
  VALUES (v_prov, v_org, 'AUD02 PROVEEDOR', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
  VALUES (v_cat, v_org, 'AUD02 FLETE', 'CostoDirectoEmbarque');

  -- Reproduccion exacta: USD100 + MXN100/TC20 = USD5, saldo USD95.
  SELECT * INTO v_fixture FROM pg_temp.fixture_liquidacion_costo(v_org, v_prov, v_cat, 'USD', 100);
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx() - 1, 100, 'MXN', 20);
  SELECT saldo INTO v_saldo FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = v_fixture.factura_id;
  PERFORM pg_temp.assert(v_saldo = 95, 'AUD02: el saldo canonico debe ser USD95');
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'MXN100 no liquida USD100');
  PERFORM set_config('app.bypass_cierre', 'off', true);
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx(), 1900, 'MXN', 20)
  RETURNING id INTO v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'dos pagos convertidos liquidan');
  SELECT fecha_pago INTO v_fecha FROM public.conceptos_costo WHERE id = v_fixture.costo_id;
  PERFORM pg_temp.assert(v_fecha = public.fecha_negocio_mx(), 'AUD02: fecha del ultimo pago vigente');
  PERFORM pg_temp.assert(current_setting('app.bypass_cierre', true) = 'off', 'AUD02: bypass restaurado tras pago');
  PERFORM set_config('app.bypass_cierre', 'on', true);
  PERFORM public.recalcular_estado_liquidacion_concepto(v_fixture.costo_id);
  PERFORM pg_temp.assert(current_setting('app.bypass_cierre', true) = 'on', 'AUD02: conserva bypass previo on');
  PERFORM set_config('app.bypass_cierre', 'off', true);
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'reverso reabre saldo');
  SELECT saldo INTO v_saldo FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = v_fixture.factura_id;
  PERFORM pg_temp.assert(v_saldo = 95, 'AUD02: pago eliminado no resta saldo');

  -- Cruce inverso y UPDATE real del importe del pago.
  SELECT * INTO v_fixture FROM pg_temp.fixture_liquidacion_costo(v_org, v_prov, v_cat, 'MXN', 100);
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx(), 5, 'USD', 20)
  RETURNING id INTO v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'USD5 liquidan MXN100');
  UPDATE public.pagos_proveedor SET monto = 2.5 WHERE id = v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'editar pago reabre saldo MXN50');

  -- Igual moneda mantiene identidad; la tolerancia monetaria no suma nominales.
  SELECT * INTO v_fixture FROM pg_temp.fixture_liquidacion_costo(v_org, v_prov, v_cat, 'USD', 100);
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx(), 99.98, 'USD') RETURNING id INTO v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'saldo0.02 aun pendiente');
  UPDATE public.pagos_proveedor SET monto = 99.99 WHERE id = v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'tolerancia canonica de0.01');
  UPDATE public.pagos_proveedor SET monto = 100 WHERE id = v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'pago USD100 mismo moneda');

  -- NC multimoneda solo resta cuando Aplicada; cancelarla revierte liquidacion.
  SELECT * INTO v_fixture FROM pg_temp.fixture_liquidacion_costo(v_org, v_prov, v_cat, 'USD', 100);
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx(), 100, 'MXN', 20);
  INSERT INTO public.proveedor_notas_credito(
    organization_id, proveedor_factura_id, fecha, folio_nc, monto, moneda, tipo_cambio
  ) VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx(), 'AUD02-NC', 1900, 'MXN', 20)
  RETURNING id INTO v_nc;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'NC Borrador no liquida');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = v_nc;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'NC Aprobada no liquida');
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = v_nc;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'NC Aplicada MXN1900 convierte USD95');
  UPDATE public.proveedor_notas_credito SET estado = 'Cancelada' WHERE id = v_nc;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'NC Cancelada reabre USD95');

  -- Todas las facturas vivas asociadas al costo deben estar liquidadas.
  SELECT * INTO v_fixture FROM pg_temp.fixture_liquidacion_costo(v_org, v_prov, v_cat, 'USD', 100, 200);
  INSERT INTO public.proveedor_facturas(
    organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion
  ) VALUES (v_org, v_prov, v_cat, 'AUD02-' || gen_random_uuid(), public.fecha_negocio_mx() - 3,
            'USD', 20, 100, 100, 'Vigente', 'aprobada') RETURNING id INTO v_segunda;
  INSERT INTO public.proveedor_facturas_conceptos(
    organization_id, proveedor_factura_id, concepto_costo_id, descripcion, monto
  ) VALUES (v_org, v_segunda, v_fixture.costo_id, 'AUD02 Segundo flete', 100);
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_org, v_fixture.factura_id, public.fecha_negocio_mx() - 1, 100, 'USD');
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'segunda factura pendiente');
  INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_org, v_segunda, public.fecha_negocio_mx(), 100, 'USD') RETURNING id INTO v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'ambas facturas liquidadas');
  UPDATE public.pagos_proveedor SET deleted_at = now() WHERE id = v_pago;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'reverso de segunda factura');
  -- Fixture de estado cancelado con vínculo legacy conservado. La marca es
  -- la misma que usa la RPC; no desactiva ni modifica ningún trigger.
  PERFORM set_config('app.cancelando_cxp', '1', true);
  UPDATE public.proveedor_facturas SET estado = 'Cancelada' WHERE id = v_segunda;
  PERFORM set_config('app.cancelando_cxp', '0', true);
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pagado', 'factura Cancelada excluida');
  SELECT fecha_pago INTO v_fecha FROM public.conceptos_costo WHERE id = v_fixture.costo_id;
  PERFORM pg_temp.assert(v_fecha = public.fecha_negocio_mx() - 1, 'AUD02: fecha excluye factura cancelada');
  UPDATE public.proveedor_facturas SET deleted_at = now() WHERE id = v_fixture.factura_id;
  PERFORM pg_temp.assert_liquidacion_costo(v_fixture.costo_id, 'Pendiente', 'sin facturas vivas no Pagado');

  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD02: liquidacion de costos coincide con saldo canonico CxP';
END;
$tests$;

ROLLBACK;
