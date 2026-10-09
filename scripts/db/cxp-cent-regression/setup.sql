-- Isolated functional fixture: full live business functions, minimum relational schema.
-- Not a migration/RLS/trigger integration test. No production data or connections.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TYPE app_role AS ENUM ('super_admin');
CREATE TYPE estado_nota_credito_proveedor AS ENUM ('Aplicada','Borrador','Cancelada');
CREATE TYPE estado_proveedor_factura AS ENUM ('Vigente','Pagada','Cancelada','Borrador');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
CREATE FUNCTION public.current_user_org_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $$;
CREATE FUNCTION public.has_role(uuid,app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE embarques(id uuid PRIMARY KEY,organization_id uuid,modo text DEFAULT 'Terrestre',tipo_carga text);
CREATE TABLE embarque_contenedores(id uuid,embarque_id uuid,deleted_at timestamptz,peso_kg numeric,volumen_m3 numeric,fecha_descarga date,fecha_devolucion date);
CREATE TABLE documentos_embarque(id uuid,embarque_id uuid,deleted_at timestamptz,archivo text,estado text);
CREATE TABLE conceptos_costo(id uuid PRIMARY KEY,embarque_id uuid,organization_id uuid,deleted_at timestamptz,proveedor_id uuid,proveedor_nombre text,origen text DEFAULT 'manual');
CREATE TABLE proveedor_facturas(id uuid PRIMARY KEY,organization_id uuid,embarque_id uuid,deleted_at timestamptz,total numeric,subtotal numeric,moneda text DEFAULT 'MXN',estado estado_proveedor_factura DEFAULT 'Vigente',estado_captura text DEFAULT 'capturada',updated_at timestamptz DEFAULT now());
CREATE TABLE proveedor_facturas_conceptos(id uuid,proveedor_factura_id uuid,concepto_costo_id uuid,monto numeric,cantidad numeric DEFAULT 1);
CREATE TABLE embarque_facturas_entrantes(id uuid,embarque_id uuid,deleted_at timestamptz,created_at timestamptz DEFAULT now(),estado text,proveedor_id uuid);
CREATE TABLE pagos_proveedor(id uuid PRIMARY KEY,proveedor_factura_id uuid,organization_id uuid,deleted_at timestamptz,monto numeric,moneda text DEFAULT 'MXN',tipo_cambio_usd numeric DEFAULT 1,monto_en_moneda_factura numeric,es_anticipo_aplicado boolean DEFAULT false);
CREATE TABLE proveedor_notas_credito(id uuid PRIMARY KEY,proveedor_factura_id uuid,organization_id uuid,deleted_at timestamptz,monto numeric,moneda text DEFAULT 'MXN',tipo_cambio numeric DEFAULT 1,estado estado_nota_credito_proveedor DEFAULT 'Aplicada');
CREATE TABLE anticipos_aplicaciones(id uuid PRIMARY KEY,proveedor_factura_id uuid,pago_proveedor_id uuid,deleted_at timestamptz,monto_aplicado numeric);
CREATE TABLE conceptos_venta(id uuid,embarque_id uuid,deleted_at timestamptz,estado_facturacion text,proforma_id uuid,moneda text);
CREATE TABLE facturas(id uuid PRIMARY KEY,embarque_id uuid,organization_id uuid,deleted_at timestamptz,estado text,moneda text,total numeric,tipo_cambio numeric,proforma_id uuid,metodo_pago text);
CREATE TABLE proformas(id uuid,deleted_at timestamptz,factura_id uuid,factura_secundaria_id uuid);
CREATE TABLE conceptos_factura(id uuid,factura_id uuid,deleted_at timestamptz,proforma_id_origen uuid);
CREATE TABLE pagos_factura(id uuid,factura_id uuid,organization_id uuid,deleted_at timestamptz,estado_rep text,monto_aplicado_factura numeric);
CREATE TABLE factura_notas_credito(id uuid,factura_id uuid,organization_id uuid,deleted_at timestamptz,estado text,monto numeric,moneda text,tipo_cambio numeric);
CREATE TABLE comisiones_devengadas(id uuid,embarque_id uuid,estado text,deleted_at timestamptz,nota text);
CREATE TABLE comisiones_recalculo_pendiente(pago_factura_id uuid,resuelto_at timestamptz);
CREATE TABLE configuracion_global(categoria text,clave text,valor text);
-- Unrelated checks are explicitly isolated, not asserted as real production passes.
CREATE FUNCTION resolver_sin_comision(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION pnl_financiero_embarque(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"utilidad_mxn":20,"venta_mxn":100}'::jsonb $$;
-- CxC is empty in all cases. This table-derived fallback is not used to prove CxP.
CREATE FUNCTION saldo_factura(p_id uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT f.total-COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM pagos_factura p WHERE p.factura_id=f.id AND p.deleted_at IS NULL),0) FROM facturas f WHERE f.id=p_id $$;

CREATE FUNCTION public.nc_convertida_a_moneda_factura(p_monto numeric, p_moneda_nc text, p_tc_nc numeric, p_moneda_factura text, p_tc_factura numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  SELECT CASE
    WHEN p_monto IS NULL OR p_moneda_factura IS NULL THEN 0
    WHEN p_moneda_nc = p_moneda_factura THEN p_monto
    WHEN p_moneda_factura = 'MXN' AND p_moneda_nc <> 'MXN' AND COALESCE(p_tc_nc, 0) > 1
      THEN p_monto * p_tc_nc
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc = 'MXN' AND COALESCE(p_tc_factura, 0) > 1
      THEN p_monto / p_tc_factura
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc <> 'MXN'
         AND p_moneda_factura <> p_moneda_nc
         AND COALESCE(p_tc_nc, 0) > 1 AND COALESCE(p_tc_factura, 0) > 1
      THEN (p_monto * p_tc_nc) / p_tc_factura
    ELSE 0
  END
$$;

CREATE FUNCTION public.pago_rep_anulado(p_estado_rep text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  SELECT lower(btrim(COALESCE(p_estado_rep, ''))) = 'cancelado'
$$;
