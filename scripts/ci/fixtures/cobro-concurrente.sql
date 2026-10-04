-- Sólo la BD efímera de rls-tests; no se ejecuta contra Lovable Cloud.
INSERT INTO public.organizations (id, nombre)
VALUES ('a0100000-0000-4000-8000-000000000001', 'Regio Forwarding QA concurrencia');
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0100000-0000-4000-8000-000000000002', 'cobros-concurrencia@example.test', '{"skip_auto_org":true}');
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('a0100000-0000-4000-8000-000000000001', 'a0100000-0000-4000-8000-000000000002', 'contador');
INSERT INTO public.clientes (id, organization_id, nombre)
VALUES ('a0100000-0000-4000-8000-000000000003', 'a0100000-0000-4000-8000-000000000001', 'Refacciones Regiomontanas QA');
INSERT INTO public.facturas (id, organization_id, cliente_id, cliente_nombre, numero,
  subtotal, iva, total, moneda, metodo_pago, fecha_emision, fecha_vencimiento, estado)
VALUES ('a0100000-0000-4000-8000-000000000004', 'a0100000-0000-4000-8000-000000000001',
  'a0100000-0000-4000-8000-000000000003', 'Refacciones Regiomontanas QA', 'QA-CONC-COBRO-1',
  1000, 0, 1000, 'MXN', 'PPD', public.fecha_negocio_mx()-1, public.fecha_negocio_mx()+30, 'Borrador');
INSERT INTO public.conceptos_factura (factura_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('a0100000-0000-4000-8000-000000000004', 'a0100000-0000-4000-8000-000000000001', 'Coordinación Ningbo-Manzanillo', 1, 1000, 1000, 'MXN');
UPDATE public.facturas SET estado='Emitida', uuid_fiscal='a0100000-0000-4000-8000-000000000005'
WHERE id='a0100000-0000-4000-8000-000000000004';
INSERT INTO public.cuentas_bancarias (id, organization_id, alias, banco, moneda, saldo_inicial, fecha_saldo_inicial, activa)
VALUES ('a0100000-0000-4000-8000-000000000006', 'a0100000-0000-4000-8000-000000000001', 'Cobros QA concurrentes', 'BBVA', 'MXN', 0, public.fecha_negocio_mx()-30, true);
CREATE UNLOGGED TABLE public.qa_cobro_barrera (id text PRIMARY KEY);
