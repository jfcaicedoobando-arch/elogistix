-- Synthetic, disposable cluster only. No remote URL, roles, grants or production data.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE public.organization_members (user_id uuid, organization_id uuid, role text);
CREATE TABLE public.facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, cliente_id uuid,
  cliente_nombre text, expediente text, cotizacion_id uuid, embarque_id uuid, proforma_id uuid,
  numero text, serie text, serie_id uuid, fecha_emision date, fecha_vencimiento date,
  dias_credito int, moneda text DEFAULT 'MXN', tipo_cambio numeric DEFAULT 1,
  subtotal numeric, iva numeric, total numeric, metodo_pago text, forma_pago text,
  uso_cfdi text, rfc_cliente text, notas text, referencia_bl text, snapshot_emision jsonb,
  estado text, origen text, sustituye_a uuid, sustituida_por uuid, uuid_fiscal text,
  deleted_at timestamptz
);
CREATE TABLE public.conceptos_factura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), factura_id uuid, organization_id uuid,
  descripcion text, cantidad numeric, precio_unitario numeric, moneda text, total numeric,
  clave_sat text, tipo_iva text, tasa_iva_aplicada numeric, tasa_ret_isr numeric,
  tasa_ret_iva numeric, monto_ret_isr numeric, monto_ret_iva numeric,
  clave_unidad text, embarque_id uuid, proforma_id_origen uuid, deleted_at timestamptz
);
CREATE TABLE public.factura_notas_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), factura_id uuid, organization_id uuid,
  deleted_at timestamptz, estado text DEFAULT 'Borrador', conceptos jsonb DEFAULT '[]',
  moneda text DEFAULT 'MXN', tipo_cambio numeric DEFAULT 1
);
CREATE TABLE public.pagos_factura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), factura_id uuid, organization_id uuid,
  uuid_rep text, facturapi_rep_id text, estado_rep text DEFAULT 'NoAplica', deleted_at timestamptz
);
CREATE TABLE public.factura_embarques (factura_id uuid, embarque_id uuid, organization_id uuid, activa boolean);
CREATE TABLE public.bitacora_actividad (organization_id uuid, usuario_id uuid, usuario_email text,
  accion text, modulo text, entidad_id uuid, entidad_nombre text, detalles jsonb);
