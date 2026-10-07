-- Audit135: ordinary chronology and retry fixtures in disposable PostgreSQL.
-- Existing guards stay active; every synthetic mutation rolls back.
BEGIN;

DO $fixture$
DECLARE
  v_org   uuid := 'd1111111-1111-1111-1111-111111111111';
  v_uid   uuid := 'd5555555-5555-5555-5555-555555555555';
  v_prov  uuid := 'd3333333-3333-3333-3333-333333333333';
  v_cat   uuid := 'd6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org D Anticipos')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'anticipos-d@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov D', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat D', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- Cuentas MXN y USD de la misma org.
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda)
  VALUES ('d7777777-7777-7777-7777-777777777777', v_org, 'MXN D', 'MXN'::public.moneda)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda)
  VALUES ('d8888888-8888-8888-8888-888888888888', v_org, 'USD D', 'USD'::public.moneda)
  ON CONFLICT (id) DO NOTHING;

  -- Anticipo MXN ya existente para probar la devolución.
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible
  ) VALUES (
    'd9999999-9999-9999-9999-999999999999', v_org, v_prov,
    public.fecha_negocio_mx() - 10, 50, 'MXN'::public.moneda, 'disponible', 50
  ) ON CONFLICT (id) DO NOTHING;

  -- Anticipo USD (TC histórico 17.1527) y factura EUR (TC histórico 18.00).
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda,
    tipo_cambio_usd, estado, saldo_disponible
  ) VALUES (
    'da000000-0000-0000-0000-00000000000a', v_org, v_prov,
    public.fecha_negocio_mx() - 5, 100, 'USD'::public.moneda,
    17.1527, 'disponible', 100
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion, fecha_emision
  ) VALUES (
    'db000000-0000-0000-0000-00000000000b', v_org, v_prov, 'Test Prov D', 'MNY-P13-01',
    v_cat, 'EUR'::public.moneda, 18.00, 200, 0, 200, 'Borrador', 'aprobada',
    public.fecha_negocio_mx()
  ) ON CONFLICT (id) DO NOTHING;

  -- DOF del día de la aplicación: USD 17.3370 / EUR 20.0000 → 100 USD = 86.6850 EUR.
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, eur_mxn, origen)
  VALUES (public.fecha_negocio_mx(), 17.3370, 20.0000, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 17.3370, eur_mxn = 20.0000;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

DO $test$
DECLARE
 v_ant uuid; v_count int; v_ap public.anticipos_aplicaciones;
 v_request uuid:=gen_random_uuid(); v_retry public.anticipos_aplicaciones;
 v_prov uuid := 'd3333333-3333-3333-3333-333333333333';
 v_fact uuid := 'db000000-0000-0000-0000-00000000000b';
BEGIN
 v_ant := (public.registrar_anticipo_proveedor(
   p_proveedor_id=>v_prov, p_monto=>1, p_moneda=>'EUR',
   p_fecha_anticipo=>public.fecha_negocio_mx(), p_metodo_pago=>'Efectivo', p_tipo_cambio_usd=>20)).id;
 SELECT count(*) INTO v_count FROM public.pagos_proveedor WHERE proveedor_factura_id=v_fact;
 BEGIN
   PERFORM public.aplicar_anticipo_a_factura(v_ant, v_fact, 1, public.fecha_negocio_mx()-1, gen_random_uuid());
   RAISE EXCEPTION 'TEST FAIL: preceding advance accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN
   IF SQLERRM NOT LIKE 'LC_ANTICIPO_APLICACION_FECHA:%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.pagos_proveedor WHERE proveedor_factura_id=v_fact) <> v_count
    OR EXISTS(SELECT 1 FROM public.anticipos_aplicaciones WHERE anticipo_id=v_ant)
    OR (SELECT saldo_disponible FROM public.anticipos_proveedor WHERE id=v_ant) <> 1 THEN
   RAISE EXCEPTION 'TEST FAIL: rejected application changed money';
 END IF;
 BEGIN
   PERFORM public.aplicar_anticipo_a_factura(v_ant, v_fact, 1, public.fecha_negocio_mx()+1, gen_random_uuid());
   RAISE EXCEPTION 'TEST FAIL: future application accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN
   IF SQLERRM NOT LIKE 'LC_PAGO_FECHA_FUTURA:%' THEN RAISE; END IF;
 END;
 -- Earlier than invoice: original USD advance predates the invoice date below.

 BEGIN
   PERFORM public.aplicar_anticipo_a_factura('da000000-0000-0000-0000-00000000000a', v_fact, 1, public.fecha_negocio_mx()-1, gen_random_uuid());
   RAISE EXCEPTION 'TEST FAIL: preceding invoice accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN
   IF SQLERRM NOT LIKE 'LC_ANTICIPO_APLICACION_FECHA:%' THEN RAISE; END IF;
 END;
 v_ap := public.aplicar_anticipo_a_factura(v_ant, v_fact, 1, public.fecha_negocio_mx(), v_request);
 IF v_ap.fecha_aplicacion <> public.fecha_negocio_mx() OR
    (SELECT saldo_disponible FROM public.anticipos_proveedor WHERE id=v_ant) <> 0 THEN
   RAISE EXCEPTION 'TEST FAIL: minimum date did not apply';
 END IF;
 v_retry := public.aplicar_anticipo_a_factura(v_ant, v_fact, 1, public.fecha_negocio_mx(), v_request);
 IF v_retry.id IS DISTINCT FROM v_ap.id
    OR (SELECT count(*) FROM public.pagos_proveedor WHERE proveedor_factura_id=v_fact) <> v_count+1 THEN
   RAISE EXCEPTION 'TEST FAIL: retry created another application or payment';
 END IF;
 IF EXISTS(SELECT 1 FROM public.bbva_movimientos WHERE anticipo_proveedor_id=v_ant) THEN
   RAISE EXCEPTION 'TEST FAIL: cash application created bank movement';
 END IF;
 RAISE NOTICE 'audit135: chronology, atomic rejection, exact minimum, future guards and idempotent retry passed';
END $test$;
ROLLBACK;
