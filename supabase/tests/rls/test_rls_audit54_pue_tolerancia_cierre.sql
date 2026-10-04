-- AUD54: ningún cobro PUE aceptado queda parcialmente pagado por tolerancias distintas.
-- Sólo DB efímera: los fixtures y todos sus efectos se revierten al finalizar.
BEGIN;
\i supabase/tests/rls/_helpers.sql
DO $tests$
DECLARE
  fx record;
  fac uuid;
  fac_limite uuid;
  cli uuid := gen_random_uuid();
  pago uuid;
  residual numeric;
  monto_mxn numeric;
  err text;
BEGIN
  -- Las facturas USD toman el TC de DOF, no del valor capturado en el INSERT.
  -- Fijar 20 en la fecha del fixture hace deterministas los cruces; el ROLLBACK lo revierte.
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE, 20, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = EXCLUDED.usd_mxn;

  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUD54');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email)
  VALUES (cli, fx.org_a, 'AUD54', 'XAXX010101000', 'aud54@example.invalid');

  FOREACH residual IN ARRAY ARRAY[0, 0.01, 0.02, 0.04, 0.05]::numeric[] LOOP
    PERFORM pg_temp.as_postgres();
    fac := gen_random_uuid();
    pago := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
      fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
    VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD54-' || residual, CURRENT_DATE,
      CURRENT_DATE + 30, 'MXN', 1, 1, 0.16, 1.16, 'Emitida', 'PUE');
    PERFORM pg_temp.as_user(fx.admin_a);

    IF residual <= 0.01 THEN
      INSERT INTO public.pagos_factura(id, factura_id, organization_id, fecha_pago, monto, moneda,
        tipo_cambio, monto_aplicado_factura, forma_pago)
      VALUES (pago, fac, fx.org_a, CURRENT_DATE, 1.16 - residual, 'MXN', 1, 1.16 - residual, 'Transferencia');
      PERFORM pg_temp.assert((SELECT estado = 'Pagada' FROM public.facturas WHERE id = fac),
        'AUD54: un pago PUE admitido debe dejar estado Pagada');
      PERFORM pg_temp.assert(public.saldo_factura(fac) = residual AND public.saldo_factura_bruto(fac) = residual,
        'AUD54: saldo canónico debe conservar exactamente ' || residual);
      PERFORM pg_temp.assert((SELECT monto_aplicado_factura = 1.16 - residual FROM public.pagos_factura WHERE id = pago),
        'AUD54: no ajustar silenciosamente el importe aplicado');
      -- El propio pago se excluye al editar, conservando monto y saldo exactos.
      UPDATE public.pagos_factura SET monto = 1.16 - residual WHERE id = pago;
      IF residual = 0.01 THEN fac_limite := fac; END IF;
    ELSE
      err := NULL;
      BEGIN
        INSERT INTO public.pagos_factura(id, factura_id, organization_id, fecha_pago, monto, moneda,
          tipo_cambio, monto_aplicado_factura, forma_pago)
        VALUES (pago, fac, fx.org_a, CURRENT_DATE, 1.16 - residual, 'MXN', 1, 1.16 - residual, 'Transferencia');
      EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      END;
      PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:%', false),
        'AUD54: residual ' || residual || ' debe rechazarse con guarda PUE; error=' || COALESCE(err, 'sin error'));
      PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_factura WHERE factura_id = fac),
        'AUD54: rechazo no debe persistir un cobro');
      PERFORM pg_temp.assert(public.saldo_factura(fac) = 1.16,
        'AUD54: rechazo debe conservar el saldo previo exacto');
    END IF;
  END LOOP;

  -- El céntimo tolerado no habilita una segunda exhibición activa.
  err := NULL;
  BEGIN
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda,
      tipo_cambio, monto_aplicado_factura, forma_pago)
    VALUES (fac_limite, fx.org_a, CURRENT_DATE, 0.01, 'MXN', 1, 0.01, 'Transferencia');
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_EXHIBICION_UNICA:%', false),
    'AUD54: el segundo pago activo debe rechazarse; error=' || COALESCE(err, 'sin error'));
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.pagos_factura WHERE factura_id = fac_limite AND deleted_at IS NULL),
    'AUD54: sólo debe existir una exhibición');
  PERFORM pg_temp.assert(public.saldo_factura(fac_limite) = 0.01,
    'AUD54: el rechazo del duplicado no cambia el residual exacto');

  -- Editar sólo monto recalcula el aplicado ANTES de validar PUE.
  err := NULL;
  BEGIN
    UPDATE public.pagos_factura SET monto = 1.12 WHERE factura_id = fac_limite;
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:%', false),
    'AUD54: no debe validar el aplicado anterior al reducir monto; error=' || COALESCE(err, 'sin error'));
  PERFORM pg_temp.assert(public.saldo_factura(fac_limite) = 0.01,
    'AUD54: edición rechazada conserva saldo e importe');

  FOREACH monto_mxn IN ARRAY ARRAY[23, 22.99]::numeric[] LOOP
    PERFORM pg_temp.as_postgres();
    fac := gen_random_uuid();
    INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
      fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
    VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD54-USD-' || monto_mxn, CURRENT_DATE,
      CURRENT_DATE + 30, 'USD', 20, 1, 0.16, 1.16, 'Emitida', 'PUE');
    PERFORM pg_temp.as_user(fx.admin_a);
    err := NULL;
    BEGIN
      INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda,
        tipo_cambio, forma_pago)
      VALUES (fac, fx.org_a, CURRENT_DATE, monto_mxn, 'MXN', 20, 'Transferencia');
    EXCEPTION WHEN raise_exception THEN
      GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
    END;
    IF monto_mxn = 23 THEN
      PERFORM pg_temp.assert(err IS NULL, 'AUD54: debe aceptar aplicado USD1.15; error=' || COALESCE(err, 'sin error'));
      PERFORM pg_temp.assert(public.saldo_factura(fac) = 0.01 AND (SELECT estado = 'Pagada' FROM public.facturas WHERE id = fac),
        'AUD54: MXN23/TC20 debe dejar USD0.01 y cerrar');
      -- Cambiar sólo el TC también debe revalidar el nuevo aplicado.
      err := NULL;
      BEGIN
        UPDATE public.pagos_factura SET tipo_cambio = 21 WHERE factura_id = fac;
      EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
      END;
      PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:%', false),
        'AUD54: el cambio de TC no puede abrir saldo PUE; error=' || COALESCE(err, 'sin error'));
      PERFORM pg_temp.assert(public.saldo_factura(fac) = 0.01, 'AUD54: cambio TC rechazado conserva saldo');
    ELSE
      PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:%', false),
        'AUD54: USD0.0105 excede cierre exacto, sin redondear a centavos; error=' || COALESCE(err, 'sin error'));
      PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.pagos_factura WHERE factura_id = fac),
        'AUD54: cruce rechazado no persiste cobro');
    END IF;
  END LOOP;

  -- Sobrepago sigue usando su guarda propia y nunca amplía el umbral PUE.
  err := NULL;
  BEGIN
    INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda,
      tipo_cambio, forma_pago)
    VALUES (fac, fx.org_a, CURRENT_DATE, 1.17, 'USD', 20, 'Transferencia');
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.assert(COALESCE(err LIKE 'LC_PAGO_SOBREPAGO:%', false),
    'AUD54: sobrepago de un centavo debe rechazarse; error=' || COALESCE(err, 'sin error'));

  -- Con NC vigentes el cierre se mide sobre la deuda neta, sin alterar el bruto.
  PERFORM pg_temp.as_postgres();
  fac := gen_random_uuid();
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, numero, fecha_emision,
    fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, metodo_pago)
  VALUES (fac, fx.org_a, cli, 'Fixture', 'AUD54-NC', CURRENT_DATE,
    CURRENT_DATE + 30, 'MXN', 1, 100, 16, 116, 'Emitida', 'PUE');
  INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto, moneda, tipo_cambio, estado, uuid_fiscal)
  VALUES (fx.org_a, fac, 'AUD54-NC58', 58, 'MXN', 1, 'Aplicada', gen_random_uuid()::text);
  PERFORM pg_temp.as_user(fx.admin_a);
  INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda,
    tipo_cambio, forma_pago)
  VALUES (fac, fx.org_a, CURRENT_DATE, 57.99, 'MXN', 1, 'Transferencia');
  PERFORM pg_temp.assert(public.saldo_factura(fac) = 0.01 AND (SELECT estado = 'Pagada' AND total = 116 FROM public.facturas WHERE id = fac),
    'AUD54: NC58 más cobro57.99 cierra con saldo exacto0.01 y total116 intacto');
END;
$tests$;
ROLLBACK;
