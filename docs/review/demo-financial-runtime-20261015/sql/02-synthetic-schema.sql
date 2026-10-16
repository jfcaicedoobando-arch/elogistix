-- Synthetic, reduced schema. No production schema/RLS-equivalence claim.
CREATE SCHEMA auth;
CREATE SCHEMA demo_flow_writer;
CREATE SCHEMA financial_fixture;
REVOKE ALL ON SCHEMA auth,demo_flow_writer,financial_fixture FROM PUBLIC;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
-- This is a clearly synthetic auth context, NOT externally authenticated identity.
CREATE TABLE financial_fixture.actor(singleton boolean PRIMARY KEY CHECK(singleton),user_id uuid REFERENCES auth.users);
INSERT INTO financial_fixture.actor VALUES(true,NULL);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT user_id FROM financial_fixture.actor WHERE singleton $$;
CREATE TABLE public.user_roles(user_id uuid REFERENCES auth.users,role public.app_role);
CREATE TABLE public.organizations(id uuid PRIMARY KEY);
CREATE TABLE public.organization_members(user_id uuid REFERENCES auth.users,organization_id uuid REFERENCES public.organizations);
CREATE TABLE public.proveedores(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations,origen_proveedor text,nombre text);
CREATE TABLE public.embarques(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations,estado text,tipo_cambio_usd numeric);
CREATE TABLE public.presupuesto_categorias(id uuid PRIMARY KEY,tipo_contable text);
CREATE TABLE public.configuracion(organization_id uuid,categoria text,clave text,valor jsonb);
CREATE TABLE public.tipos_cambio_dof(fecha date PRIMARY KEY,usd_mxn numeric,eur_mxn numeric,fuente text,origen text);
CREATE TABLE public.proveedor_facturas(
 id uuid PRIMARY KEY,organization_id uuid NOT NULL REFERENCES public.organizations,
 proveedor_id uuid REFERENCES public.proveedores,embarque_id uuid REFERENCES public.embarques,
 categoria_presupuesto_id uuid REFERENCES public.presupuesto_categorias,
 proveedor_nombre text,folio_proveedor text,created_by uuid REFERENCES auth.users,
 estado public.estado_proveedor_factura DEFAULT 'Vigente',
 estado_aprobacion public.estado_aprobacion_factura_proveedor DEFAULT 'pendiente',
 updated_at timestamptz NOT NULL DEFAULT '2026-10-15T00:00:00Z', deleted_at timestamptz,
 aprobada_por uuid REFERENCES auth.users,aprobada_at timestamptz,motivo_rechazo text,
 aprobacion_heredada boolean DEFAULT false,justificacion_sin_vinculo text,
 moneda public.moneda DEFAULT 'MXN',subtotal numeric DEFAULT 100,iva numeric DEFAULT 16,
 ieps numeric DEFAULT 0,total numeric DEFAULT 116,tipo_cambio_usd numeric,
 fecha_emision date DEFAULT '2026-10-15',uuid_fiscal text,uuid_verificado boolean DEFAULT false,
 fecha_cancelacion timestamptz,motivo_cancelacion text,cancelada_por uuid REFERENCES auth.users
);
CREATE TABLE public.conceptos_costo(id uuid PRIMARY KEY,concepto text,moneda public.moneda,monto numeric,embarque_id uuid REFERENCES public.embarques,deleted_at timestamptz,origen text);
CREATE TABLE public.proveedor_facturas_conceptos(id uuid PRIMARY KEY,proveedor_factura_id uuid REFERENCES public.proveedor_facturas,concepto_costo_id uuid REFERENCES public.conceptos_costo,cantidad numeric,monto numeric);
CREATE TABLE public.pagos_proveedor(id uuid PRIMARY KEY,proveedor_factura_id uuid REFERENCES public.proveedor_facturas,monto numeric,deleted_at timestamptz);
CREATE TABLE public.embarque_facturas_entrantes(id uuid PRIMARY KEY,proveedor_factura_id uuid REFERENCES public.proveedor_facturas,estado text,rechazo_motivo text,capturado_por uuid,updated_at timestamptz,deleted_at timestamptz);
CREATE TABLE public.bitacora_actividad(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid,usuario_id uuid,usuario_email text,accion text,modulo text,entidad_id uuid,entidad_nombre text,detalles jsonb,fuente_evento text);
