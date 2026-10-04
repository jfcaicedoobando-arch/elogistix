-- RPC real: retry idéntico, payload distinto y fallo posterior en el banco.
-- Sólo Postgres efímero de Actions; no PAC, no credenciales ni datos remotos.
BEGIN;
INSERT INTO public.organizations (id, nombre)
VALUES ('a0090000-0000-4000-8000-000000000001', 'Regio Forwarding QA');
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0090000-0000-4000-8000-000000000002', 'cobros-qa@example.test', '{"skip_auto_org":true}');
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('a0090000-0000-4000-8000-000000000001', 'a0090000-0000-4000-8000-000000000002', 'contador');
INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('a0090000-0000-4000-8000-000000000003', 'a0090000-0000-4000-8000-000000000001',
        'Refacciones Industriales Regiomontanas', 'compras@example.test');
INSERT INTO public.facturas (id, organization_id, cliente_id, cliente_nombre, numero,
  subtotal, iva, total, moneda, metodo_pago, fecha_emision, fecha_vencimiento, estado)
VALUES ('a0090000-0000-4000-8000-000000000004', 'a0090000-0000-4000-8000-000000000001',
  'a0090000-0000-4000-8000-000000000003', 'Refacciones Industriales Regiomontanas', 'QA-COBRO-1',
  1000, 0, 1000, 'MXN', 'PPD', public.fecha_negocio_mx() - 1, public.fecha_negocio_mx() + 30, 'Borrador');
INSERT INTO public.conceptos_factura (factura_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('a0090000-0000-4000-8000-000000000004', 'a0090000-0000-4000-8000-000000000001',
        'Coordinación logística Ningbo–Manzanillo', 1, 1000, 1000, 'MXN');
UPDATE public.facturas SET estado = 'Emitida', uuid_fiscal = 'a0090000-0000-4000-8000-000000000005'
WHERE id = 'a0090000-0000-4000-8000-000000000004';
INSERT INTO public.cuentas_bancarias (id, organization_id, alias, banco, moneda,
  saldo_inicial, fecha_saldo_inicial, activa)
VALUES ('a0090000-0000-4000-8000-000000000006', 'a0090000-0000-4000-8000-000000000001',
        'Cobros QA MXN', 'BBVA', 'MXN', 0, public.fecha_negocio_mx() - 30, true);

-- Inyección de fallo sólo para NUESTRA referencia. La lógica del cobro no
-- se copia ni se sustituye; falla la escritura bancaria después del INSERT.
CREATE FUNCTION pg_temp.rechazar_abono_qa() RETURNS trigger LANGUAGE plpgsql AS $test$
BEGIN
  IF NEW.cuenta_bancaria_id = 'a0090000-0000-4000-8000-000000000006'::uuid
     AND NEW.referencia = 'QA-FALLO-BANCO' THEN
    RAISE EXCEPTION 'QA_BANCO_NO_DISPONIBLE';
  END IF;
  RETURN NEW;
END
$test$;
CREATE TRIGGER qa_cobro_fallo BEFORE INSERT ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION pg_temp.rechazar_abono_qa();
SELECT set_config('request.jwt.claims', '{"sub":"a0090000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_first jsonb;
  v_retry jsonb;
  v_id uuid;
  v_error text;
BEGIN
  v_first := public.registrar_pago_factura_atomico(
    'a0090000-0000-4000-8000-000000000004', public.fecha_negocio_mx(), 100, 'MXN', 1, 100,
    '03', 'SPEI-QA-1', '', 0, 'a0090000-0000-4000-8000-000000000006', 'a0090000-0000-4000-8000-000000000007');
  v_id := (v_first->>'pago_id')::uuid;
  v_retry := public.registrar_pago_factura_atomico(
    'a0090000-0000-4000-8000-000000000004', public.fecha_negocio_mx(), 100, 'MXN', 1, 100,
    '03', 'SPEI-QA-1', '', 0, 'a0090000-0000-4000-8000-000000000006', 'a0090000-0000-4000-8000-000000000007');
  IF v_id IS NULL OR (v_retry->>'pago_id')::uuid <> v_id OR (v_retry->>'reintento')::boolean IS NOT TRUE
     OR (SELECT count(*) FROM public.pagos_factura WHERE factura_id = 'a0090000-0000-4000-8000-000000000004' AND deleted_at IS NULL) <> 1
     OR (SELECT count(*) FROM public.bbva_movimientos WHERE pago_factura_id = v_id AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: retry debe conservar exactamente un cobro y un abono';
  END IF;
  BEGIN
    PERFORM public.registrar_pago_factura_atomico(
      'a0090000-0000-4000-8000-000000000004', public.fecha_negocio_mx(), 101, 'MXN', 1, 101,
      '03', 'SPEI-QA-1', '', 0, 'a0090000-0000-4000-8000-000000000006', 'a0090000-0000-4000-8000-000000000007');
    RAISE EXCEPTION 'FAIL: aceptó otra cantidad con la misma llave';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE '%LC_PAGO_REINTENTO_DISTINTO%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_pago_factura_atomico(
      'a0090000-0000-4000-8000-000000000004', public.fecha_negocio_mx(), 50, 'MXN', 1, 50,
      '03', 'QA-FALLO-BANCO', '', 0, 'a0090000-0000-4000-8000-000000000006', 'a0090000-0000-4000-8000-000000000008');
    RAISE EXCEPTION 'FAIL: persistió el cobro cuando falló el banco';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE '%QA_BANCO_NO_DISPONIBLE%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.pagos_factura WHERE client_request_id = 'a0090000-0000-4000-8000-000000000008')
     OR EXISTS (SELECT 1 FROM public.bbva_movimientos WHERE referencia = 'QA-FALLO-BANCO' AND cuenta_bancaria_id = 'a0090000-0000-4000-8000-000000000006')
     OR (SELECT count(*) FROM public.pagos_factura WHERE factura_id = 'a0090000-0000-4000-8000-000000000004' AND deleted_at IS NULL) <> 1 THEN
    RAISE EXCEPTION 'FAIL: fallo bancario dejó filas o alteró el cobro anterior';
  END IF;
  RAISE NOTICE 'PASS: retry, conflicto de payload y rollback bancario verifican RPC real';
END
$test$;
ROLLBACK;
