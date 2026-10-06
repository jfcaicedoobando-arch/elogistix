-- Sólo la BD efímera de rls-tests; no se ejecuta contra Lovable Cloud.
INSERT INTO public.organizations (id, nombre)
VALUES ('a0110000-0000-4000-8000-000000000001', 'Regio Forwarding QA concurrencia');
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('a0110000-0000-4000-8000-000000000002', 'factura-concurrencia@example.test', '{"skip_auto_org":true}');
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('a0110000-0000-4000-8000-000000000001', 'a0110000-0000-4000-8000-000000000002', 'admin_org');
INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('a0110000-0000-4000-8000-000000000003', 'a0110000-0000-4000-8000-000000000001', 'Refacciones Regiomontanas QA', 'compras-concurrencia@example.test');
CREATE UNLOGGED TABLE public.qa_factura_manual_barrera (id text PRIMARY KEY);
