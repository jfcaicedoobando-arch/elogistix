-- =============================================================
-- fix3_nc_recalcular_deleted_at.sql · FIX3 tanda 3 (Ronda-2 P3)
--
-- trg_nc_cliente_recalcular_comisiones ahora escucha deleted_at y la
-- SALIDA de 'Aplicada' (alineado con el hermano trg_recalcular_estado_factura_nc):
--   · CASO 1: soft-delete de una NC aplicada → la comisión se recalcula
--     SOLA (sin llamada manual a calcular_comision_pago) y vuelve al
--     devengado pleno.
--   · CASO 2: cancelación Aplicada→Cancelada (transición permitida por
--     guard_nc_cliente_transicion) → mismo efecto.
--   · CASO 3 (guarda anti-espuria): UPDATE que no cambia nada relevante
--     sobre una NC en Borrador no encola ni rompe nada.
--
-- Mecánica (idéntica a fix_b4 CASO 3): utilidad 400 (venta 1000 − costos
-- 600), vendedora 10% → devengado pleno 40.00; pago 100% + NC 20% aplicada
-- (sembrada con session_replication_role=replica, como dato legado) → 32.00.
-- Al salir la NC (papelera o cancelación) debe volver a 40.00.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_nc_recalcular_deleted_at.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Fixture común (mismo patrón que fix_b4).
INSERT INTO public.organizations (id, nombre)
VALUES ('dd4dd4dd-0000-4000-8000-000000000010', 'Test FIX3 NC Recalc');

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('dd4dd4dd-0000-4000-8000-000000000011', 'dd4dd4dd-0000-4000-8000-000000000010', 'Cliente FIX3', 'fix3-nc-recalc@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('dd4dd4dd-0000-4000-8000-000000000020', 'dd4dd4dd-0000-4000-8000-000000000010',
        'dd4dd4dd-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'dd4dd4dd-0000-4000-8000-000000000012', 20);

INSERT INTO public.vendedora_config (organization_id, user_id, porcentaje_default, activa)
VALUES ('dd4dd4dd-0000-4000-8000-000000000010', 'dd4dd4dd-0000-4000-8000-000000000012', 10, true);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('dd4dd4dd-0000-4000-8000-000000000020', 'dd4dd4dd-0000-4000-8000-000000000010', 'Flete', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('dd4dd4dd-0000-4000-8000-000000000020', 'dd4dd4dd-0000-4000-8000-000000000010', 'Maniobras', 600, 'MXN');

-- Factura + pago al 100% → comisión plena 40.00.
INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('dd4dd4dd-0000-4000-8000-000000000030', 'dd4dd4dd-0000-4000-8000-000000000010', 'FIX3-F1',
        'dd4dd4dd-0000-4000-8000-000000000011', 'dd4dd4dd-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('dd4dd4dd-0000-4000-8000-000000000031', 'dd4dd4dd-0000-4000-8000-000000000030',
        'dd4dd4dd-0000-4000-8000-000000000010', CURRENT_DATE, 1000, 'MXN', 1, 1000);

-- NC 200 'Aplicada' sembrada como dato legado (sin guards) + recálculo manual
-- → comisión baja a 32.00 (comportamiento FIX B-4 ya cubierto).
SET LOCAL session_replication_role = replica;
INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision, uuid_fiscal)
VALUES ('dd4dd4dd-0000-4000-8000-000000000032', 'dd4dd4dd-0000-4000-8000-000000000010',
        'dd4dd4dd-0000-4000-8000-000000000030', 'FIX3-NC1', 'Descuento', 200, 'MXN', 1, 'Aplicada', CURRENT_DATE,
        'dd4dd4dd-0000-4000-8000-000000000032');
SET LOCAL session_replication_role = origin;

SELECT public.calcular_comision_pago('dd4dd4dd-0000-4000-8000-000000000031');

DO $$
DECLARE
  v_com numeric;
BEGIN
  SELECT comision_mxn INTO v_com FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'dd4dd4dd-0000-4000-8000-000000000031';
  PERFORM pg_temp.assert(v_com = 32.00,
    format('FIXTURE: 100%% cobrado + NC 20%% aplicada debería dar 32.00; dio %s', v_com));
END $$;

-- -------------------------------------------------------------
-- CASO 1: soft-delete de la NC → el trigger (que ahora escucha
-- deleted_at) recalcula SOLO: la comisión vuelve a 40.00 sin llamada
-- manual a calcular_comision_pago.
-- -------------------------------------------------------------
UPDATE public.factura_notas_credito
   SET deleted_at = now()
 WHERE id = 'dd4dd4dd-0000-4000-8000-000000000032';

DO $$
DECLARE
  v_com numeric;
BEGIN
  SELECT comision_mxn INTO v_com FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'dd4dd4dd-0000-4000-8000-000000000031';
  PERFORM pg_temp.assert(v_com = 40.00,
    format('CASO 1: tras la papelera de la NC la comisión debía volver a 40.00 (quedó congelada en %s)', v_com));
  RAISE NOTICE 'CASO 1 OK · NC a papelera → comisión recalculada por el trigger (40.00).';
END $$;

-- -------------------------------------------------------------
-- CASO 2: segunda NC aplicada → 32.00; cancelación Aplicada→Cancelada
-- (permitida por guard_nc_cliente_transicion) → vuelve a 40.00.
-- -------------------------------------------------------------
SET LOCAL session_replication_role = replica;
INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision, uuid_fiscal)
VALUES ('dd4dd4dd-0000-4000-8000-000000000042', 'dd4dd4dd-0000-4000-8000-000000000010',
        'dd4dd4dd-0000-4000-8000-000000000030', 'FIX3-NC2', 'Descuento', 200, 'MXN', 1, 'Aplicada', CURRENT_DATE,
        'dd4dd4dd-0000-4000-8000-000000000042');
SET LOCAL session_replication_role = origin;

SELECT public.calcular_comision_pago('dd4dd4dd-0000-4000-8000-000000000031');

UPDATE public.factura_notas_credito
   SET estado = 'Cancelada'
 WHERE id = 'dd4dd4dd-0000-4000-8000-000000000042';

DO $$
DECLARE
  v_com numeric;
BEGIN
  SELECT comision_mxn INTO v_com FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'dd4dd4dd-0000-4000-8000-000000000031';
  PERFORM pg_temp.assert(v_com = 40.00,
    format('CASO 2: al cancelar la NC aplicada la comisión debía volver a 40.00 (quedó congelada en %s)', v_com));
  RAISE NOTICE 'CASO 2 OK · NC Aplicada→Cancelada → comisión recalculada por el trigger (40.00).';
END $$;

-- -------------------------------------------------------------
-- CASO 3: NC en Borrador con update irrelevante → la guarda temprana
-- sigue evitando trabajo espurio (sin encolar, sin error).
-- -------------------------------------------------------------
INSERT INTO public.factura_notas_credito (id, organization_id, factura_id, folio, motivo, monto, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('dd4dd4dd-0000-4000-8000-000000000052', 'dd4dd4dd-0000-4000-8000-000000000010',
        'dd4dd4dd-0000-4000-8000-000000000030', 'FIX3-NC3', 'Descuento', 100, 'MXN', 1, 'Borrador', CURRENT_DATE);

UPDATE public.factura_notas_credito
   SET folio = 'FIX3-NC3b'
 WHERE id = 'dd4dd4dd-0000-4000-8000-000000000052';

DO $$
DECLARE
  v_com numeric;
  v_cola int;
BEGIN
  SELECT comision_mxn INTO v_com FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'dd4dd4dd-0000-4000-8000-000000000031';
  PERFORM pg_temp.assert(v_com = 40.00,
    format('CASO 3: un update irrelevante en una NC en Borrador movió la comisión (%s)', v_com));
  SELECT count(*) INTO v_cola FROM public.comisiones_recalculo_pendiente
   WHERE pago_factura_id = 'dd4dd4dd-0000-4000-8000-000000000031';
  PERFORM pg_temp.assert(v_cola = 0, 'CASO 3: se encoló un recálculo espurio');
  RAISE NOTICE 'CASO 3 OK · guarda anti-espuria intacta.';
END $$;

ROLLBACK;
