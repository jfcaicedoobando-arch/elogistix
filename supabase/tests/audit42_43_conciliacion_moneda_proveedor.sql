-- AUD42/43: moneda nativa del banco y saldo global aprobado, org-scoped.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  prov uuid := gen_random_uuid();
  otro uuid := gen_random_uuid();
  cat uuid := gen_random_uuid();
  usd uuid := gen_random_uuid();
  mxn uuid := gen_random_uuid();
  pagada uuid := gen_random_uuid();
  pendiente uuid := gen_random_uuid();
  fac uuid;
  pago uuid;
  doc jsonb;
  res jsonb;
  fila jsonb;
  err text;
  caso record;
  tc_invalido numeric;
  esperado_error text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD4243');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (prov, fx.org_a, 'AUD4243', 'GastoOperativo', 'Otros'),
         (otro, fx.org_a, 'AUD4243 OTRO', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre) VALUES (cat, fx.org_a, 'AUD4243');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (usd, fx.org_a, 'AUD4243 USD', 'USD', 1000, public.fecha_negocio_mx() - 30),
         (mxn, fx.org_a, 'AUD4243 MXN', 'MXN', 1000, public.fecha_negocio_mx() - 30);
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
  VALUES (pagada, fx.org_a, prov, cat, 'AUD43-USD1', public.fecha_negocio_mx(), 'USD', 20, 1, 1, 'Vigente', 'aprobada'),
         (pendiente, fx.org_a, prov, cat, 'AUD43-USD95', public.fecha_negocio_mx() - 90, 'USD', 20, 95, 95, 'Vigente', 'aprobada'),
         (gen_random_uuid(), fx.org_a, prov, cat, 'AUD43-MXN40', public.fecha_negocio_mx() - 90, 'MXN', 1, 40, 40, 'Vigente', 'aprobada'),
         (gen_random_uuid(), fx.org_a, prov, cat, 'AUD43-DRAFT', public.fecha_negocio_mx(), 'USD', 20, 200, 200, 'Borrador', 'aprobada'),
         (gen_random_uuid(), fx.org_a, prov, cat, 'AUD43-UNAPPROVED', public.fecha_negocio_mx(), 'USD', 20, 300, 300, 'Vigente', 'pendiente'),
         (gen_random_uuid(), fx.org_a, otro, cat, 'AUD43-OTHER', public.fecha_negocio_mx(), 'USD', 20, 500, 500, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  doc := public.registrar_pago_proveedor_atomico(p_factura_id => pagada, p_fecha_pago => public.fecha_negocio_mx(),
    p_monto => 1, p_moneda => 'USD', p_metodo_pago => 'Transferencia', p_tipo_cambio_usd => 20, p_cuenta_bancaria_id => usd);
  pago := (doc->>'pago_id')::uuid;
  res := public.conciliar_tesoreria_proveedor(p_factura_id => pagada);
  PERFORM pg_temp.assert((res->>'facturas_revisadas')::int = 1 AND jsonb_array_length(res->'facturas') = 1,
    'AUD43: recalcular/detalle siguen sólo factura seleccionada');
  PERFORM pg_temp.assert(jsonb_array_length(res->'incidencias') = 0, 'AUD42: USD1/TC20 bancoUSD1 no es descuadreMXN');
  SELECT x INTO fila FROM jsonb_array_elements(res->'proveedores') x WHERE x->>'moneda' = 'USD';
  PERFORM pg_temp.assert((fila->>'saldo_pendiente')::numeric = 95 AND (fila->>'facturas_abiertas')::int = 1,
    'AUD43: proveedor globalUSD95 incluye mes previo y excluye no aprobadas/borradores/otro');
  SELECT x INTO fila FROM jsonb_array_elements(res->'proveedores') x WHERE x->>'moneda' = 'MXN';
  PERFORM pg_temp.assert((fila->>'saldo_pendiente')::numeric = 40, 'AUD43: MXN separado deUSD');
  BEGIN
    PERFORM public.conciliar_tesoreria_proveedor(p_proveedor_id => otro, p_factura_id => pagada);
    RAISE EXCEPTION 'AUD43: permitió proveedor incongruente';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_CONCILIACION_ALCANCE_INVALIDO:%', 'AUD43: mismatch debe fallar sin cambios');
  END;

  -- Descuadre se compara en USD, mantiene equivalente MXN separado.
  UPDATE public.bbva_movimientos SET cargo = .96 WHERE pago_proveedor_id = pago;
  res := public.conciliar_tesoreria_proveedor(p_factura_id => pagada);
  fila := res->'incidencias'->0;
  PERFORM pg_temp.assert(fila->>'moneda_cuenta' = 'USD' AND (fila->>'cargo_cuenta')::numeric = .96
    AND (fila->>'monto_esperado_cuenta')::numeric = 1 AND (fila->>'cargo_mxn')::numeric = 19.2,
    'AUD42: descuadre usaUSD.96 esperadoUSD1; equivalenteMXN19.20');
  UPDATE public.bbva_movimientos SET cargo = .99 WHERE pago_proveedor_id = pago;
  res := public.conciliar_tesoreria_proveedor(p_factura_id => pagada);
  PERFORM pg_temp.assert(jsonb_array_length(res->'incidencias') = 0, 'AUD42: tolerancia.01 en moneda bancaria');

  -- Cross FX exige un TC finito positivo y no deja un pago/banco a medias.
  PERFORM pg_temp.as_postgres();
  fac := gen_random_uuid();
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
  VALUES (fac, fx.org_a, prov, cat, 'AUD42-TC-' || fac, public.fecha_negocio_mx(), 'USD', 20, 100, 100, 'Vigente', 'aprobada');
  PERFORM pg_temp.as_user(fx.admin_a);
  FOREACH tc_invalido IN ARRAY ARRAY[NULL::numeric, 0::numeric, 'NaN'::numeric, 'Infinity'::numeric] LOOP
    BEGIN
      PERFORM public.registrar_pago_proveedor_atomico(p_factura_id => fac, p_fecha_pago => public.fecha_negocio_mx(),
        p_monto => 1, p_moneda => 'USD', p_metodo_pago => 'Transferencia', p_tipo_cambio_usd => tc_invalido, p_cuenta_bancaria_id => mxn);
      RAISE EXCEPTION 'AUD42: cruce sinTCfinito fue permitido';
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS esperado_error = MESSAGE_TEXT;
      PERFORM pg_temp.assert(esperado_error LIKE 'LC_PAGO_TC_REQUERIDO:%', 'AUD42: guardTC no rechazó correctamente: ' || esperado_error);
    END;
  END LOOP;
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_proveedor WHERE proveedor_factura_id = fac),
    'AUD42: fallo bancario debe revertir el pago atómicamente');

  -- Matriz real: pago/moneda bancaria iguales y ambos cruces FX.
  FOR caso IN SELECT * FROM (VALUES ('MXN', 'MXN', 20::numeric, 20::numeric),
                                    ('USD', 'MXN', 1::numeric, 20::numeric),
                                    ('MXN', 'USD', 20::numeric, 1::numeric)) t(moneda_pago, moneda_banco, monto, cargo)
  LOOP
    PERFORM pg_temp.as_postgres();
    fac := gen_random_uuid();
    INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
      fecha_emision, moneda, tipo_cambio_usd, subtotal, total, estado, estado_aprobacion)
    VALUES (fac, fx.org_a, prov, cat, 'AUD42-' || fac, public.fecha_negocio_mx(), caso.moneda_pago::public.moneda,
      20, caso.monto, caso.monto, 'Vigente', 'aprobada');
    PERFORM pg_temp.as_user(fx.admin_a);
    doc := public.registrar_pago_proveedor_atomico(p_factura_id => fac, p_fecha_pago => public.fecha_negocio_mx(),
      p_monto => caso.monto, p_moneda => caso.moneda_pago, p_metodo_pago => 'Transferencia', p_tipo_cambio_usd => 20,
      p_cuenta_bancaria_id => CASE WHEN caso.moneda_banco = 'USD' THEN usd ELSE mxn END);
    PERFORM pg_temp.assert((SELECT cargo = caso.cargo FROM public.bbva_movimientos WHERE id = (doc->>'movimiento_id')::uuid),
      'AUD42: movimiento real debe estar en moneda bancaria');
    INSERT INTO public.bbva_movimientos(organization_id, cuenta_bancaria_id, fecha, cargo, abono, hash_dedupe, concepto)
    VALUES (fx.org_a, CASE WHEN caso.moneda_banco = 'USD' THEN usd ELSE mxn END, public.fecha_negocio_mx(), .25, 0,
      'AUD42-COMISION-' || fac, 'Comisión separada del pago');
    res := public.conciliar_tesoreria_proveedor(p_factura_id => fac);
    PERFORM pg_temp.assert(jsonb_array_length(res->'incidencias') = 0, 'AUD42: FX compatible no debe generar falso descuadre');
  END LOOP;
  PERFORM pg_temp.as_user(fx.admin_b);
  BEGIN
    PERFORM public.conciliar_tesoreria_proveedor(p_factura_id => pagada);
    RAISE EXCEPTION 'AUD43: factura otraorg fue permitida';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    PERFORM pg_temp.assert(err LIKE 'LC_CONCILIACION_ALCANCE_INVALIDO:%', 'AUD43: org ajena debe rechazarse');
  END;
END;
$tests$;
ROLLBACK;
