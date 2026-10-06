-- Auditoría70–71: RPC real en base efímera, fixtures nuevos transaccionales.
-- NC multimoneda en movimiento/aging; devolución total y remanente aplicado,
-- parcial legacy sin banco, fecha efectiva/apertura, aislamiento de tenant.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_orgs record;
  v_prov uuid := gen_random_uuid();
  v_prov_ant uuid := gen_random_uuid();
  v_prov_legacy uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cta uuid := gen_random_uuid();
  v_f_usd uuid := gen_random_uuid();
  v_f_mxn uuid := gen_random_uuid();
  v_f_ant uuid := gen_random_uuid();
  v_nc_mxn uuid := gen_random_uuid();
  v_nc_usd uuid := gen_random_uuid();
  v_legacy uuid := gen_random_uuid();
  v_ant public.anticipos_proveedor;
  v_total public.anticipos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_data jsonb;
  v_mov jsonb;
  v_saldo numeric;
  v_hoy date := public.fecha_negocio_mx();
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD70_71');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_orgs.org_a, 'AUD70 NC', 'GastoOperativo', 'Otros'),
         (v_prov_ant, v_orgs.org_a, 'AUD71 ANTICIPOS', 'GastoOperativo', 'Otros'),
         (v_prov_legacy, v_orgs.org_a, 'AUD71 LEGACY', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (v_cat, v_orgs.org_a, 'AUD70_71 CATEGORIA');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, fecha_saldo_inicial)
  VALUES (v_cta, v_orgs.org_a, 'AUD71 BANCO', 'MXN', v_hoy - 20);
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, fecha_vencimiento, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion
  ) VALUES
    (v_f_usd, v_orgs.org_a, v_prov, v_cat, 'AUD70-USD', v_hoy - 10, v_hoy - 1, 'USD', 20, 116, 116, 'Vigente', 'aprobada'),
    (v_f_mxn, v_orgs.org_a, v_prov, v_cat, 'AUD70-MXN', v_hoy - 10, v_hoy - 1, 'MXN', 1, 2300, 2300, 'Vigente', 'aprobada'),
    (v_f_ant, v_orgs.org_a, v_prov_ant, v_cat, 'AUD71-MXN', v_hoy - 10, v_hoy - 1, 'MXN', 1, 100, 100, 'Vigente', 'aprobada');
  INSERT INTO public.proveedor_notas_credito(
    id, organization_id, proveedor_factura_id, fecha, folio_nc, monto, moneda, tipo_cambio
  , subtotal) VALUES
    (v_nc_mxn, v_orgs.org_a, v_f_usd, v_hoy - 8, 'AUD70-NC-MXN', 2000, 'MXN', 20, 2000),
    (v_nc_usd, v_orgs.org_a, v_f_mxn, v_hoy - 8, 'AUD70-NC-USD', 100, 'USD', 20, 100);
  -- Dato legacy parcial sin movimiento bancario. Sólo este fixture efímero:
  -- no habilita nuevos reembolsos parciales ni repara registros existentes.
  INSERT INTO public.anticipos_proveedor(
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, metodo_pago,
    estado, saldo_disponible, monto_devuelto, devuelto_at
  ) VALUES (v_legacy, v_orgs.org_a, v_prov_legacy, v_hoy - 9, 50, 'MXN', 'Efectivo',
            'disponible', 40, 10, (v_hoy - 5)::timestamp AT TIME ZONE 'America/Mexico_City');
  INSERT INTO public.anticipos_proveedor(
    organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible
  ) VALUES (v_orgs.org_a, v_prov_ant, v_hoy - 9, 25, 'MXN', 'cancelado', 0);
  PERFORM pg_temp.as_user(v_orgs.admin_a);

  v_data := public.proveedor_estado_cuenta_movimientos(v_prov);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'movimientos') m
    WHERE m->>'tipo' = 'Nota de crédito'), 'AUD70: NC Borrador no descuenta movimientos');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id IN (v_nc_mxn, v_nc_usd);
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov);
  SELECT (a->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'aging') a
  WHERE a->>'moneda' = 'USD';
  PERFORM pg_temp.assert(v_saldo = 116 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'movimientos') m
    WHERE m->>'tipo' = 'Nota de crédito'), 'AUD70: NC sólo Aprobada no descuenta movimientos/aging');
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id IN (v_nc_mxn, v_nc_usd);

  v_data := public.proveedor_estado_cuenta_movimientos(v_prov);
  SELECT m INTO STRICT v_mov FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'ref_id' = v_nc_mxn::text;
  PERFORM pg_temp.assert(v_mov->>'moneda' = 'USD' AND (v_mov->>'abono')::numeric = 100,
    'AUD70: NC MXN2000@20 debe abonar USD100');
  SELECT m INTO STRICT v_mov FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'ref_id' = v_nc_usd::text;
  PERFORM pg_temp.assert(v_mov->>'moneda' = 'MXN' AND (v_mov->>'abono')::numeric = 2000,
    'AUD70: NC USD100@20 debe abonar MXN2000');
  SELECT (s->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'saldos') s
  WHERE s->>'moneda' = 'USD';
  PERFORM pg_temp.assert(v_saldo = 16, 'AUD70: estado USD116 menos NCUSD100 debe conservar USD16');
  SELECT (a->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'aging') a
  WHERE a->>'moneda' = 'USD';
  PERFORM pg_temp.assert(v_saldo = 16 AND v_saldo = (public.saldo_factura_proveedor(v_f_usd)->>'saldo')::numeric,
    'AUD70: aging debe conservar USD16 y coincidir con saldo canónico de factura');
  SELECT (a->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'aging') a
  WHERE a->>'moneda' = 'MXN';
  PERFORM pg_temp.assert(v_saldo = 300, 'AUD70: aging de cruce inverso debe conservar MXN300');

  -- Aplicada borrada ya no descuenta; Borrador/Aprobada/Cancelada tampoco.
  UPDATE public.proveedor_notas_credito SET deleted_at = now() WHERE id = v_nc_mxn;
  UPDATE public.proveedor_notas_credito SET estado = 'Cancelada' WHERE id = v_nc_usd;
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov);
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'movimientos') m
    WHERE m->>'tipo' = 'Nota de crédito'), 'AUD70: NC eliminadas/canceladas no deben aparecer');
  SELECT (a->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'aging') a
  WHERE a->>'moneda' = 'USD';
  PERFORM pg_temp.assert(v_saldo = 116, 'AUD70: soft-delete debe restaurar agingUSD116');

  -- Dinero original permanece histórico; devolución es un cargo en su fecha.
  v_total := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov_ant, p_monto => 0.03, p_moneda => 'MXN',
    p_fecha_anticipo => v_hoy - 9, p_metodo_pago => 'Transferencia', p_cuenta_bancaria_id => v_cta);
  v_total := public.devolver_anticipo_proveedor(v_total.id, 0.03, v_hoy - 5, v_cta, 'AUD71 TOTAL', 'Reembolso fixture');
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_ant);
  SELECT SUM((m->>'cargo')::numeric - (m->>'abono')::numeric) INTO v_saldo
  FROM jsonb_array_elements(v_data->'movimientos') m WHERE m->>'ref_id' = v_total.id::text;
  PERFORM pg_temp.assert(v_saldo = 0, 'AUD71: anticipo0.03 totalmente devuelto no reduce deuda');
  SELECT m INTO STRICT v_mov FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'ref_id' = v_total.id::text AND m->>'tipo' = 'Devolución de anticipo';
  PERFORM pg_temp.assert((v_mov->>'cargo')::numeric = 0.03 AND (v_mov->>'fecha')::date = v_hoy - 5,
    'AUD71: devolución conserva monto y fecha de negocio bancaria, no devuelto_at actual');
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_ant, NULL, v_hoy - 6);
  SELECT SUM((m->>'abono')::numeric) INTO v_saldo FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'ref_id' = v_total.id::text;
  PERFORM pg_temp.assert(v_saldo = 0.03 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_data->'movimientos') m
    WHERE m->>'tipo' = 'Devolución de anticipo'), 'AUD71: periodo anterior conserva anticipo sin devolución futura');

  -- Aplicar10 de25 y devolver15 reduce deuda sólo10, sin duplicar la aplicación.
  v_ant := public.registrar_anticipo_proveedor(
    p_proveedor_id => v_prov_ant, p_monto => 25, p_moneda => 'MXN',
    p_fecha_anticipo => v_hoy - 9, p_metodo_pago => 'Transferencia', p_cuenta_bancaria_id => v_cta);
  v_ap := public.aplicar_anticipo_a_factura(v_ant.id, v_f_ant, 10, v_hoy - 7);
  v_ant := public.devolver_anticipo_proveedor(v_ant.id, 15, v_hoy - 5, v_cta, 'AUD71 REMANENTE', 'Devolver remanente fixture');
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_ant);
  SELECT m INTO STRICT v_mov FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'ref_id' = v_ap.pago_proveedor_id::text;
  PERFORM pg_temp.assert(v_mov->>'tipo' = 'Anticipo aplicado' AND (v_mov->>'cargo')::numeric = 0
    AND (v_mov->>'abono')::numeric = 0, 'AUD71: aplicación informativa conserva0/0');
  SELECT (s->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'saldos') s
  WHERE s->>'moneda' = 'MXN';
  PERFORM pg_temp.assert(v_saldo = 90, 'AUD71: factura100 menos anticipo25 más devolución15 debe dar90');
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_ant, v_hoy - 4, v_hoy);
  SELECT (a->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'saldo_apertura') a
  WHERE a->>'moneda' = 'MXN';
  PERFORM pg_temp.assert(v_saldo = 90 AND jsonb_array_length(v_data->'movimientos') = 0,
    'AUD71: apertura posterior a devolución incluye sólo neto aplicado, sin anticipo cancelado');

  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_legacy);
  SELECT (s->>'saldo')::numeric INTO STRICT v_saldo FROM jsonb_array_elements(v_data->'saldos') s
  WHERE s->>'moneda' = 'MXN';
  PERFORM pg_temp.assert(v_saldo = -40, 'AUD71: parcial legacy50 menos devuelto10 conserva favor40');
  SELECT m INTO STRICT v_mov FROM jsonb_array_elements(v_data->'movimientos') m
  WHERE m->>'tipo' = 'Devolución de anticipo';
  PERFORM pg_temp.assert((v_mov->>'fecha')::date = v_hoy - 5 AND v_mov->>'detalle' LIKE 'Sin fecha bancaria%',
    'AUD71: legacy sin banco usa fecha registro y explicita alcance');

  PERFORM pg_temp.as_user(v_orgs.admin_b);
  v_data := public.proveedor_estado_cuenta_movimientos(v_prov_ant);
  PERFORM pg_temp.assert(jsonb_array_length(v_data->'movimientos') = 0
    AND jsonb_array_length(v_data->'saldos') = 0, 'AUD70_71: proveedor ajeno no expone movimientos/saldos');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD70_71: NC multimoneda, aging y devoluciones/apertura sin duplicación verificadas';
END;
$tests$;

ROLLBACK;
