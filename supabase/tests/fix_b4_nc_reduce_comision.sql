-- =============================================================
-- fix_b4_nc_reduce_comision.sql · FIX B-4 (O2.3) comportamental
--
-- Casos (todos con fixtures reales y recálculo vía trigger/RPC):
--   · CASO 1 — factura liquidada con NC (pago 80% + NC 20% aplicada vía
--              ciclo real vigente Borrador→Timbrada→Aplicada (el guard
--              guard_nc_cliente_transicion ya no admite Borrador→Aprobada)): la comisión
--              queda en el 80% del devengado pleno; la NC NO la infla.
--   · CASO 2 — pago parcial + NC: la comisión NO sube tras la NC (el bug
--              Fase A/B la subía de 0.50 a 0.625 de proporción).
--   · CASO 3 — dato legado sobre-liquidado (cobrada 100% y NC aplicada
--              después, estado que los guards actuales ya no permiten): el
--              tope al documento neto SÍ baja la comisión proporcionalmente.
--   · CASO 4 — consolidada multi-embarque (B-2) con NC: comisión
--              prorrateada correcta (no 0, no cola consolidada_sin_embarque).
--   · CASO 5 — _reprocesar_comisiones_org NO auto-resuelve entradas
--              ajuste_nc_liquidada (quedan visibles para revisión manual).
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix_b4_nc_reduce_comision.sql
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- Fixture común: org, cliente, vendedora al 10%.
-- Utilidad del embarque E1: venta 1000 − costos 600 = 400 MXN.
-- Comisión plena (100% cobrado, sin NC) = 400 × 1 × 10% = 40.00.
-- -------------------------------------------------------------
INSERT INTO public.organizations (id, nombre)
VALUES ('bb4b4b4b-0000-4000-8000-000000000010', 'Test B4 NC Comisión');

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('bb4b4b4b-0000-4000-8000-000000000011', 'bb4b4b4b-0000-4000-8000-000000000010', 'Cliente B4', 'fix-b4@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('bb4b4b4b-0000-4000-8000-000000000020', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'bb4b4b4b-0000-4000-8000-000000000012', 20);

INSERT INTO public.vendedora_config (organization_id, user_id, porcentaje_default, activa)
VALUES ('bb4b4b4b-0000-4000-8000-000000000010', 'bb4b4b4b-0000-4000-8000-000000000012', 10, true);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000020', 'bb4b4b4b-0000-4000-8000-000000000010', 'Flete', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000020', 'bb4b4b4b-0000-4000-8000-000000000010', 'Maniobras', 600, 'MXN');

-- -------------------------------------------------------------
-- CASO 1: factura 1000, pago 800, NC 200 aplicada por ciclo real.
-- Esperado post-NC: 400 × (800/1000) × 10% = 32.00 (80% del pleno).
-- -------------------------------------------------------------
INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000030', 'bb4b4b4b-0000-4000-8000-000000000010', 'B4-F1',
        'bb4b4b4b-0000-4000-8000-000000000011', 'bb4b4b4b-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('bb4b4b4b-0000-4000-8000-000000000031', 'bb4b4b4b-0000-4000-8000-000000000030',
        'bb4b4b4b-0000-4000-8000-000000000010', CURRENT_DATE, 800, 'MXN', 1, 800);

INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000032', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000030', 'B4-NC1', 'Descuento', 200, 'MXN', 1, 'Borrador', CURRENT_DATE);
UPDATE public.factura_notas_credito SET estado = 'Timbrada', uuid_fiscal = 'bb4b4b4b-0000-4000-8000-000000000032' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000032';
UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000032';

DO $caso1$
DECLARE
  v_com numeric; v_utl numeric; v_cob numeric;
BEGIN
  SELECT comision_mxn, utilidad_prorrateada_mxn, monto_cobrado_mxn
    INTO v_com, v_utl, v_cob
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000031';

  IF v_com IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: no se devengó comisión para el pago';
  END IF;
  -- 80% del devengado pleno (40.00): la NC del 20% baja la base cobrada.
  IF v_com <> 32.00 OR v_utl <> 320.00 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: 100%% liquidado + NC 20%% debería dar 32.00 (80%% del pleno); dio comision=% utilidad_prorrateada=%', v_com, v_utl;
  END IF;
  RAISE NOTICE 'CASO 1 OK · factura liquidada con NC 20%%: comisión % (80%% del pleno 40.00).', v_com;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: pago parcial 500 + NC 200. Antes de la NC: 20.00.
-- Con el bug la proporción subía 0.50 → 0.625 (comisión 25.00).
-- Esperado post-NC: sigue en 20.00 (no sube).
-- -------------------------------------------------------------
INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000040', 'bb4b4b4b-0000-4000-8000-000000000010', 'B4-F2',
        'bb4b4b4b-0000-4000-8000-000000000011', 'bb4b4b4b-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('bb4b4b4b-0000-4000-8000-000000000041', 'bb4b4b4b-0000-4000-8000-000000000040',
        'bb4b4b4b-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500);

INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000042', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000040', 'B4-NC2', 'Descuento', 200, 'MXN', 1, 'Borrador', CURRENT_DATE);
UPDATE public.factura_notas_credito SET estado = 'Timbrada', uuid_fiscal = 'bb4b4b4b-0000-4000-8000-000000000042' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000042';
UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000042';

DO $caso2$
DECLARE
  v_com numeric;
BEGIN
  SELECT comision_mxn INTO v_com
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000041';

  IF v_com IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no se devengó comisión para el pago parcial';
  END IF;
  IF v_com > 20.00 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la comisión SUBIÓ tras la NC (antes 20.00, ahora %)', v_com;
  END IF;
  IF v_com <> 20.00 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: parcial 500/1000 con NC 200 debería seguir en 20.00; dio %', v_com;
  END IF;
  RAISE NOTICE 'CASO 2 OK · pago parcial + NC: comisión estable en % (no sube).', v_com;
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: dato legado sobre-liquidado (cobrada 100% y NC aplicada
-- después — estado que los guards trg_nc_no_excede_saldo /
-- assert_factura_viva_para_pago ya no permiten crear hoy). Se siembra
-- con session_replication_role=replica y se recalcula por la RPC.
-- Esperado: 40.00 → 32.00 (baja exactamente el 20% de la NC).
--
-- Embarque propio (E3): el prorrateo reparte la utilidad del embarque entre
-- TODAS sus facturas, así que reutilizar E1 (que ya tiene B4-F1 y B4-F2)
-- diluía la comisión plena a 24.00 y el caso medía el prorrateo, no el tope
-- por nota de crédito que aquí se quiere verificar.
-- -------------------------------------------------------------
INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('bb4b4b4b-0000-4000-8000-000000000053', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'bb4b4b4b-0000-4000-8000-000000000012', 20);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000053', 'bb4b4b4b-0000-4000-8000-000000000010', 'Flete E3', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000053', 'bb4b4b4b-0000-4000-8000-000000000010', 'Maniobras E3', 600, 'MXN');

INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000050', 'bb4b4b4b-0000-4000-8000-000000000010', 'B4-F3',
        'bb4b4b4b-0000-4000-8000-000000000011', 'bb4b4b4b-0000-4000-8000-000000000053',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('bb4b4b4b-0000-4000-8000-000000000051', 'bb4b4b4b-0000-4000-8000-000000000050',
        'bb4b4b4b-0000-4000-8000-000000000010', CURRENT_DATE, 1000, 'MXN', 1, 1000);

DO $caso3$
DECLARE
  v_antes numeric; v_despues numeric;
BEGIN
  SELECT comision_mxn INTO v_antes
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000051';
  IF v_antes <> 40.00 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el 100%% cobrado sin NC debería dar 40.00; dio %', v_antes;
  END IF;
END
$caso3$ LANGUAGE plpgsql;

-- Siembra de la NC legada sin disparar guards (fixture, no flujo real).
SET LOCAL session_replication_role = replica;
INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000052', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000050', 'B4-NC3', 'Descuento', 200, 'MXN', 1, 'Aplicada', CURRENT_DATE);
SET LOCAL session_replication_role = origin;

-- Recálculo explícito (lo que haría el reproceso nocturno).
SELECT public.calcular_comision_pago('bb4b4b4b-0000-4000-8000-000000000051');

DO $caso3b$
DECLARE
  v_despues numeric;
BEGIN
  SELECT comision_mxn INTO v_despues
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000051';
  IF v_despues <> 32.00 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: cobrada 100%% + NC 20%% (legado) debería bajar a 32.00; dio %', v_despues;
  END IF;
  RAISE NOTICE 'CASO 3 OK · legado sobre-liquidado: 40.00 → % (−20%% proporcional a la NC).', v_despues;
END
$caso3b$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: consolidada multi-embarque (B-2) con NC.
-- E_A: venta 600 − costos 300 = 300 · E_B: venta 400 − costos 100 = 300.
-- Utilidad conjunta 600... (300+300), venta bruta conjunta 1000.
-- Factura consolidada 1000 (sin embarque directo), pago 800 + NC 200.
-- Esperado: 600 × (800/1000) × 10% = 48.00, anclada al titular E_A
-- (mayor venta neta), sin entrada consolidada_sin_embarque en la cola.
-- -------------------------------------------------------------
INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('bb4b4b4b-0000-4000-8000-000000000060', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'bb4b4b4b-0000-4000-8000-000000000012', 20),
       ('bb4b4b4b-0000-4000-8000-000000000061', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'bb4b4b4b-0000-4000-8000-000000000012', 20);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000060', 'bb4b4b4b-0000-4000-8000-000000000010', 'Flete A', 1, 600, 600, 'MXN'),
       ('bb4b4b4b-0000-4000-8000-000000000061', 'bb4b4b4b-0000-4000-8000-000000000010', 'Flete B', 1, 400, 400, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('bb4b4b4b-0000-4000-8000-000000000060', 'bb4b4b4b-0000-4000-8000-000000000010', 'Costo A', 300, 'MXN'),
       ('bb4b4b4b-0000-4000-8000-000000000061', 'bb4b4b4b-0000-4000-8000-000000000010', 'Costo B', 100, 'MXN');

INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000070', 'bb4b4b4b-0000-4000-8000-000000000010', 'B4-FC',
        'bb4b4b4b-0000-4000-8000-000000000011', NULL,
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
VALUES ('bb4b4b4b-0000-4000-8000-000000000070', 'bb4b4b4b-0000-4000-8000-000000000060', 'bb4b4b4b-0000-4000-8000-000000000010', true),
       ('bb4b4b4b-0000-4000-8000-000000000070', 'bb4b4b4b-0000-4000-8000-000000000061', 'bb4b4b4b-0000-4000-8000-000000000010', true);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('bb4b4b4b-0000-4000-8000-000000000071', 'bb4b4b4b-0000-4000-8000-000000000070',
        'bb4b4b4b-0000-4000-8000-000000000010', CURRENT_DATE, 800, 'MXN', 1, 800);

INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb4b4b4b-0000-4000-8000-000000000072', 'bb4b4b4b-0000-4000-8000-000000000010',
        'bb4b4b4b-0000-4000-8000-000000000070', 'B4-NCC', 'Descuento', 200, 'MXN', 1, 'Borrador', CURRENT_DATE);
UPDATE public.factura_notas_credito SET estado = 'Timbrada', uuid_fiscal = 'bb4b4b4b-0000-4000-8000-000000000072' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000072';
UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = 'bb4b4b4b-0000-4000-8000-000000000072';

DO $caso4$
DECLARE
  v_com numeric; v_utl numeric; v_emb uuid; v_nota text; v_cola bigint;
BEGIN
  SELECT comision_mxn, utilidad_prorrateada_mxn, embarque_id, nota
    INTO v_com, v_utl, v_emb, v_nota
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000071';

  IF v_com IS NULL THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: la consolidada no devengó comisión';
  END IF;
  IF v_com = 0 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: comisión 0 en consolidada (regresión O2.4); nota=%', v_nota;
  END IF;
  IF v_com <> 48.00 OR v_utl <> 480.00 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: consolidada con NC debería dar 48.00/480.00; dio %/%', v_com, v_utl;
  END IF;
  IF v_emb <> 'bb4b4b4b-0000-4000-8000-000000000060' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: el ancla debería ser el embarque de mayor venta neta; quedó %', v_emb;
  END IF;

  SELECT count(*) INTO v_cola
    FROM public.comisiones_recalculo_pendiente
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000071'
     AND etapa = 'consolidada_sin_embarque'
     AND resuelto_at IS NULL;
  IF v_cola > 0 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: la consolidada resuelta no debería encolarse como consolidada_sin_embarque';
  END IF;
  RAISE NOTICE 'CASO 4 OK · consolidada multi-embarque con NC: comisión % prorrateada, sin cola.', v_com;
END
$caso4$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 5: el reproceso NO auto-resuelve ajuste_nc_liquidada.
-- -------------------------------------------------------------
DO $caso5$
DECLARE
  v_res record;
  v_abierto timestamptz;
  v_resuelto timestamptz;
BEGIN
  -- Entrada de ajuste sobre comisión ya liquidada (la siembra el trigger
  -- O2.3 cuando la NC llega tarde) + una entrada control resoluble.
  INSERT INTO public.comisiones_recalculo_pendiente
    (organization_id, pago_factura_id, etapa, motivo)
  VALUES
    ('bb4b4b4b-0000-4000-8000-000000000010', 'bb4b4b4b-0000-4000-8000-000000000031',
     'ajuste_nc_liquidada', 'NC sobre comisión ya liquidada: descontar en la siguiente'),
    ('bb4b4b4b-0000-4000-8000-000000000010', 'bb4b4b4b-0000-4000-8000-000000000041',
     'utilidad_embarque', 'control: recálculo sano');

  SELECT * INTO v_res FROM public._reprocesar_comisiones_org('bb4b4b4b-0000-4000-8000-000000000010');

  SELECT resuelto_at INTO v_abierto
    FROM public.comisiones_recalculo_pendiente
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000031'
     AND etapa = 'ajuste_nc_liquidada';
  IF v_abierto IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: el reproceso auto-resolvió un ajuste_nc_liquidada sin aplicar descuento';
  END IF;

  SELECT resuelto_at INTO v_resuelto
    FROM public.comisiones_recalculo_pendiente
   WHERE pago_factura_id = 'bb4b4b4b-0000-4000-8000-000000000041'
     AND etapa = 'utilidad_embarque';
  IF v_resuelto IS NULL THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: la entrada control (recálculo sano) debió resolverse';
  END IF;

  RAISE NOTICE 'CASO 5 OK · ajuste_nc_liquidada queda visible (procesadas=%, resueltas=%).', v_res.procesadas, v_res.resueltas;
END
$caso5$ LANGUAGE plpgsql;

ROLLBACK;
