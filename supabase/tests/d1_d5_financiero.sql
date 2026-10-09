-- =============================================================
-- Lote D1–D5 (v13.823.382)
--  D1 · pnl_financiero_embarque: las notas de crédito se convierten a la
--       moneda de la factura ANTES de restarse y de aplicar el factor de
--       atribución multiembarque (funcional: factura MXN 1000 con NC de base USD10,
--       monto fiscal USD11.60 @20 → venta real800).
--  D2 · registrar_pago_factura_atomico: cobro + abono bancario en la misma
--       transacción, idempotente por client_request_id (contrato).
--  D3 · registrar_traspaso_bancario: fecha nula o futura se rechaza en SQL y
--       no deja traspasos ni movimientos (funcional).
--  D4 · guard_pago_proveedor / registrar_pago_proveedor_atomico: fecha
--       requerida, no futura y no anterior a la emisión (contrato).
--  D5 · actualizar_pago_proveedor_atomico: pago + reemplazo del movimiento
--       derivado en una sola transacción; las líneas importadas se
--       desvinculan, nunca se borran (contrato).
-- Todo dentro de BEGIN…ROLLBACK; no toca datos históricos.
-- =============================================================

BEGIN;

-- ── Contratos sobre el catálogo ───────────────────────────────────────────
DO $contratos$
DECLARE
  v_def text;
BEGIN
  -- D1 client-NC behavior is verified below without depending on SQL aliases.
  -- Preserve the existing supplier-NC conversion guard in this same suite.
  v_def := pg_get_functiondef('public.pnl_financiero_embarque(uuid)'::regprocedure);
  IF v_def !~ 'monto_pago_en_moneda_factura' THEN
    RAISE EXCEPTION 'D1 FAIL: la NC de proveedor vuelve a restarse sin convertir';
  END IF;

  -- D2
  v_def := pg_get_functiondef(
    'public.registrar_pago_factura_atomico(uuid,date,numeric,text,numeric,numeric,text,text,text,numeric,uuid,uuid)'::regprocedure);
  IF v_def !~ 'asegurar_movimiento_cobro_factura' THEN
    RAISE EXCEPTION 'D2 FAIL: el cobro ya no registra su abono bancario espejo';
  END IF;
  IF v_def !~ 'LC_COBRO_MOVIMIENTO_FALLIDO' THEN
    RAISE EXCEPTION 'D2 FAIL: un abono fallido ya no revierte el cobro';
  END IF;
  IF v_def !~ 'client_request_id' OR v_def !~ 'unique_violation' THEN
    RAISE EXCEPTION 'D2 FAIL: el reintento por client_request_id ya no es idempotente';
  END IF;

  -- D3
  v_def := pg_get_functiondef(
    'public.registrar_traspaso_bancario(uuid,uuid,date,numeric,numeric,numeric,text,text,uuid)'::regprocedure);
  IF v_def !~ 'LC_TRASPASO_FECHA_FUTURA' OR v_def !~ 'LC_TRASPASO_FECHA_REQUERIDA' THEN
    RAISE EXCEPTION 'D3 FAIL: el traspaso ya no valida la fecha en el servidor';
  END IF;

  -- D4
  v_def := pg_get_functiondef('public.guard_pago_proveedor()'::regprocedure);
  IF v_def !~ 'LC_PAGO_FECHA_FUTURA' OR v_def !~ 'LC_PAGO_FECHA_PREVIA_EMISION' THEN
    RAISE EXCEPTION 'D4 FAIL: el guard del pago dejó de validar la fecha';
  END IF;
  IF v_def !~ 'NEW\.fecha_pago IS NOT DISTINCT FROM OLD\.fecha_pago' THEN
    RAISE EXCEPTION 'D4 FAIL: la fecha volvió a contarse como "sólo metadato" en UPDATE';
  END IF;
  v_def := pg_get_functiondef(
    'public.registrar_pago_proveedor_atomico(uuid,date,numeric,text,text,text,uuid,text,numeric,numeric,uuid)'::regprocedure);
  IF v_def !~ 'LC_PAGO_FECHA_FUTURA' OR v_def !~ 'LC_PAGO_FECHA_PREVIA_EMISION' THEN
    RAISE EXCEPTION 'D4 FAIL: el alta directa de pago ya no valida la fecha';
  END IF;

  -- D5
  v_def := pg_get_functiondef(
    'public.actualizar_pago_proveedor_atomico(uuid,date,numeric,text,numeric,text,text,uuid,text,numeric,timestamptz)'::regprocedure);
  IF v_def !~ 'FOR UPDATE' THEN
    RAISE EXCEPTION 'D5 FAIL: la edición del pago ya no bloquea pago/factura';
  END IF;
  IF v_def !~ 'LC_CONFLICTO_CONCURRENCIA' THEN
    RAISE EXCEPTION 'D5 FAIL: se perdió el bloqueo optimista de la edición';
  END IF;
  IF v_def !~ 'SET pago_proveedor_id = NULL' THEN
    RAISE EXCEPTION 'D5 FAIL: una línea importada real ya no se desvincula (se borraría)';
  END IF;
  IF v_def !~ '_asegurar_movimiento_pago_proveedor' THEN
    RAISE EXCEPTION 'D5 FAIL: la edición ya no regenera la salida bancaria';
  END IF;
  RAISE NOTICE '✓ D1–D5: contratos de conversión de NC, atomicidad y fechas';
END
$contratos$ LANGUAGE plpgsql;

-- ── Fixture común ────────────────────────────────────────────────────────
INSERT INTO public.organizations (id, nombre)
VALUES ('d1d50000-0000-4000-8000-000000000001'::uuid, 'D1 Financiero Org');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('d1d50000-0000-4000-8000-0000000000a1', 'd1-fin@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('d1d50000-0000-4000-8000-000000000001'::uuid,
        'd1d50000-0000-4000-8000-0000000000a1', 'contador'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.clientes (id, nombre, email, organization_id)
VALUES ('d1d50000-0000-4000-8000-0000000000c1'::uuid, 'Cliente D1',
        'd1-cliente@test.mx', 'd1d50000-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.embarques (id, cliente_id, cliente_nombre, modo, tipo, organization_id, tipo_cambio_usd)
VALUES ('d1d50000-0000-4000-8000-0000000000e1'::uuid,
        'd1d50000-0000-4000-8000-0000000000c1'::uuid, 'Cliente D1',
        'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
        'd1d50000-0000-4000-8000-000000000001'::uuid, 20);

-- ── D1: base NC10USD @20 resta200; monto fiscal11.60USD no es base ──
INSERT INTO public.facturas (
  id, numero, cliente_id, cliente_nombre, embarque_id, organization_id,
  subtotal, iva, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado
) VALUES (
  'd1d50000-0000-4000-8000-0000000000f1'::uuid, 'D1-NC-USD',
  'd1d50000-0000-4000-8000-0000000000c1'::uuid, 'Cliente D1',
  'd1d50000-0000-4000-8000-0000000000e1'::uuid,
  'd1d50000-0000-4000-8000-000000000001'::uuid,
  1000, 0, 1000, 'MXN'::public.moneda, 1, CURRENT_DATE, CURRENT_DATE + 30,
  'Borrador'::public.estado_factura
);

INSERT INTO public.conceptos_factura (
  factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, embarque_id
) VALUES (
  'd1d50000-0000-4000-8000-0000000000f1'::uuid, 'flete', 1, 1000,
  'MXN'::public.moneda, 1000, 'd1d50000-0000-4000-8000-000000000001'::uuid,
  'd1d50000-0000-4000-8000-0000000000e1'::uuid
);

UPDATE public.facturas SET estado = 'Emitida'::public.estado_factura
WHERE id = 'd1d50000-0000-4000-8000-0000000000f1'::uuid;

INSERT INTO public.factura_notas_credito (
  factura_id, folio, monto, moneda, tipo_cambio, estado, organization_id, uuid_fiscal, conceptos
) VALUES (
  'd1d50000-0000-4000-8000-0000000000f1'::uuid, 'D1-NC-1', 11.60,
  'USD'::public.moneda, 20, 'Timbrada'::public.estado_nota_credito,
  'd1d50000-0000-4000-8000-000000000001'::uuid,
  'd1d50000-0000-4000-8000-00000000dddd',
  '[{"cantidad":1,"precio_unitario":10,"tasa_iva":0.16}]'::jsonb
);

DO $d1$
DECLARE
  v_venta numeric;
  v_pnl jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'd1d50000-0000-4000-8000-0000000000a1')::text, true);

  v_venta := (public.pnl_financiero_embarque('d1d50000-0000-4000-8000-0000000000e1'::uuid)
                #>> '{venta,real_mxn}')::numeric;
  IF round(v_venta, 2) IS DISTINCT FROM 800.00 THEN
    RAISE EXCEPTION 'D1 FAIL: venta real % en lugar de 800 (base NC10USD @20, bruto11.60USD, factura MXN1000)', v_venta;
  END IF;
  -- Timbrada/Aplicada retain the same base. This legacy note has no lineage;
  -- AUD144 keeps its known amount provisional even on a single shipment.
  UPDATE public.factura_notas_credito SET estado = 'Aplicada'
    WHERE uuid_fiscal = 'd1d50000-0000-4000-8000-00000000dddd';
  v_pnl := public.pnl_financiero_embarque('d1d50000-0000-4000-8000-0000000000e1');
  IF (v_pnl #>> '{venta,real_mxn}')::numeric IS DISTINCT FROM 800
     OR v_pnl->>'estado_ingresos' IS DISTINCT FROM 'incompleto'
     OR (v_pnl #>> '{ingresos_documentacion,repartos_provisionales}')::int IS DISTINCT FROM 1
     OR (v_pnl #>> '{ingresos_documentacion,notas_credito_activas}')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'D1 FAIL: Timbrada/Aplicada no conservan base convertida conocida: %', v_pnl;
  END IF;
  IF (SELECT sum((x->>'real_mxn')::numeric)
      FROM jsonb_array_elements(v_pnl->'por_concepto') x) IS DISTINCT FROM 800 THEN
    RAISE EXCEPTION 'D1 FAIL: detalle de venta no concilia la base convertida: %', v_pnl;
  END IF;

  -- Fiscal debt still uses the gross11.60USD×20=232MXN. Economic income
  -- above subtracts only the base10USD×20=200MXN, independently of invoice tax.
  IF public.saldo_factura('d1d50000-0000-4000-8000-0000000000f1') IS DISTINCT FROM
     (SELECT total - 232 FROM public.facturas WHERE id='d1d50000-0000-4000-8000-0000000000f1') THEN
    RAISE EXCEPTION 'D1 FAIL: saldo fiscal no conserva el bruto NC11.60USD convertido';
  END IF;

  -- An existing legacy NC may have no economic concepts. Its gross monto is
  -- fiscal debt, not an inferred P&L base; keep the known amount provisional.
  INSERT INTO public.factura_notas_credito (
    factura_id, folio, monto, moneda, tipo_cambio, estado, organization_id,
    uuid_fiscal, conceptos
  ) VALUES (
    'd1d50000-0000-4000-8000-0000000000f1', 'D1-NC-UNKNOWN', 1, 'USD', 20,
    'Timbrada', 'd1d50000-0000-4000-8000-000000000001',
    'd1d50000-0000-4000-8000-00000000ddde', '[]'::jsonb
  );
  v_pnl := public.pnl_financiero_embarque('d1d50000-0000-4000-8000-0000000000e1');
  IF (v_pnl #>> '{venta,real_mxn}')::numeric IS DISTINCT FROM 800
     OR v_pnl->>'estado_ingresos' IS DISTINCT FROM 'incompleto'
     OR (v_pnl #>> '{ingresos_documentacion,notas_credito_activas}')::int IS DISTINCT FROM 2
     OR (v_pnl #>> '{ingresos_documentacion,notas_credito_sin_base}')::int IS DISTINCT FROM 1
     OR v_pnl->'utilidad_mxn' IS DISTINCT FROM 'null'::jsonb
     OR v_pnl->'margen_real_pct' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'D1 FAIL: NC sin base debe preservar venta conocida e incompletitud: %', v_pnl;
  END IF;
  IF (SELECT x->'real_mxn' FROM jsonb_array_elements(v_pnl->'por_concepto') x
      WHERE x->>'concepto' = '(nota de crédito)') IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'D1 FAIL: detalle de NC desconocida se convirtió en cero conocido: %', v_pnl;
  END IF;
  RAISE NOTICE '✓ D1: base NC USD convertida; Timbrada/Aplicada iguales; legado desconocido permanece provisional';

  PERFORM set_config('request.jwt.claims', NULL, true);
END
$d1$ LANGUAGE plpgsql;

-- ── D3 funcional: fecha futura no deja traspaso ni movimientos ────────────
INSERT INTO public.cuentas_bancarias (
  id, organization_id, alias, banco, moneda, saldo_inicial, fecha_saldo_inicial, activa
) VALUES
  ('d1d50000-0000-4000-8000-0000000000b1'::uuid, 'd1d50000-0000-4000-8000-000000000001'::uuid,
   'Origen D3', 'BBVA', 'MXN'::public.moneda, 100000, CURRENT_DATE - 30, true),
  ('d1d50000-0000-4000-8000-0000000000b2'::uuid, 'd1d50000-0000-4000-8000-000000000001'::uuid,
   'Destino D3', 'BBVA', 'MXN'::public.moneda, 0, CURRENT_DATE - 30, true);

DO $d3$
DECLARE
  v_err text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'd1d50000-0000-4000-8000-0000000000a1')::text, true);

  BEGIN
    PERFORM public.registrar_traspaso_bancario(
      'd1d50000-0000-4000-8000-0000000000b1'::uuid,
      'd1d50000-0000-4000-8000-0000000000b2'::uuid,
      CURRENT_DATE + 5, 1000, NULL, 0, 'Traspaso futuro', '', NULL);
    RAISE EXCEPTION 'D3 FAIL: el traspaso con fecha futura fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err !~ 'LC_TRASPASO_FECHA_FUTURA' THEN RAISE; END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.traspasos_bancarios
              WHERE cuenta_origen_id = 'd1d50000-0000-4000-8000-0000000000b1'::uuid) THEN
    RAISE EXCEPTION 'D3 FAIL: quedó un traspaso con fecha futura';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bbva_movimientos
              WHERE cuenta_bancaria_id IN ('d1d50000-0000-4000-8000-0000000000b1'::uuid,
                                           'd1d50000-0000-4000-8000-0000000000b2'::uuid)) THEN
    RAISE EXCEPTION 'D3 FAIL: quedaron movimientos bancarios con fecha futura';
  END IF;

  BEGIN
    PERFORM public.registrar_traspaso_bancario(
      'd1d50000-0000-4000-8000-0000000000b1'::uuid,
      'd1d50000-0000-4000-8000-0000000000b2'::uuid,
      NULL, 1000, NULL, 0, 'Traspaso sin fecha', '', NULL);
    RAISE EXCEPTION 'D3 FAIL: el traspaso sin fecha fue aceptado';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    IF v_err !~ 'LC_TRASPASO_FECHA_REQUERIDA' THEN RAISE; END IF;
  END;

  RAISE NOTICE '✓ D3: fecha futura o vacía rechazada sin dejar movimientos';
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$d3$ LANGUAGE plpgsql;

ROLLBACK;
