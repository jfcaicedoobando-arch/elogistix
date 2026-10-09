-- Refuse standalone use outside this runner's owned loopback-only cluster.
DO $$ BEGIN
  IF current_setting('cluster_name') <> 'audit144_owned_local'
    OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR current_setting('unix_socket_directories') <> '' THEN
    RAISE EXCEPTION 'AUD144 fixture requires its disposable owned local cluster';
  END IF;
END $$;
-- Disposable local PostgreSQL fixture. Minimal tables for the existing reporting
-- function, no remote connections, application data, identity writes or ACL tests.
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('super_admin');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION public.current_user_org_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.tc_dof_vigente(date) RETURNS TABLE(usd_mxn numeric,eur_mxn numeric) LANGUAGE sql STABLE AS $$ SELECT NULL::numeric,NULL::numeric $$;
CREATE FUNCTION public.saldo_factura(uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT 0::numeric $$;
CREATE TABLE public.embarques(id uuid PRIMARY KEY, organization_id uuid, tipo_cambio_usd numeric, tipo_cambio_eur numeric, deleted_at timestamptz);
CREATE TABLE public.conceptos_venta(id uuid PRIMARY KEY, embarque_id uuid, descripcion text, moneda text, total numeric, deleted_at timestamptz);
CREATE TABLE public.conceptos_costo(id uuid PRIMARY KEY, organization_id uuid, embarque_id uuid, concepto text, moneda text, monto numeric, proveedor_id uuid, proveedor_nombre text, origen text, deleted_at timestamptz);
CREATE TABLE public.seguros_embarque(id uuid PRIMARY KEY, organization_id uuid, embarque_id uuid, proveedor_factura_id uuid, aseguradora text, prima numeric(14,2), moneda text, deleted_at timestamptz);
CREATE TABLE public.facturas(id uuid PRIMARY KEY, embarque_id uuid, subtotal numeric, moneda text, estado text, total numeric, tipo_cambio numeric, fecha_emision date, deleted_at timestamptz);
CREATE TABLE public.conceptos_factura(id uuid PRIMARY KEY, factura_id uuid, embarque_id uuid, total numeric, descripcion text, deleted_at timestamptz);
CREATE TABLE public.factura_notas_credito(id uuid PRIMARY KEY, factura_id uuid, monto numeric, moneda text, tipo_cambio numeric, estado text, deleted_at timestamptz);
CREATE TABLE public.proveedor_facturas(id uuid PRIMARY KEY, organization_id uuid, embarque_id uuid, proveedor_id uuid, proveedor_nombre text, subtotal numeric, total numeric, moneda text, estado text, tipo_cambio_usd numeric, fecha_emision date, deleted_at timestamptz);
CREATE TABLE public.proveedor_facturas_conceptos(id uuid PRIMARY KEY, proveedor_factura_id uuid, concepto_costo_id uuid, descripcion text, monto numeric, cantidad numeric);
CREATE TABLE public.proveedor_notas_credito(id uuid PRIMARY KEY, proveedor_factura_id uuid, subtotal numeric, monto numeric, moneda text, tipo_cambio numeric, tipo_cambio_mxn numeric, estado text, deleted_at timestamptz);
CREATE TABLE public.pagos_proveedor(id uuid PRIMARY KEY, proveedor_factura_id uuid, monto_en_moneda_factura numeric, deleted_at timestamptz);

CREATE FUNCTION pg_temp.id(text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5($1)::uuid $$;
CREATE FUNCTION pg_temp.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF;
END $$;

ALTER TABLE facturas ADD COLUMN organization_id uuid DEFAULT current_user_org_id();
ALTER TABLE conceptos_factura ADD COLUMN organization_id uuid DEFAULT current_user_org_id();
ALTER TABLE factura_notas_credito ADD COLUMN organization_id uuid DEFAULT current_user_org_id();
ALTER TABLE factura_notas_credito ADD COLUMN conceptos jsonb;

CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE FUNCTION public.monto_pago_en_moneda_factura(p_monto numeric, p_moneda_pago text, p_tc_pago numeric, p_moneda_factura text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_factura THEN RETURN p_monto; END IF;
  IF COALESCE(p_tc_pago, 0) <= 0 THEN RETURN NULL; END IF;
  IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / p_tc_pago, 4); END IF;
  IF p_moneda_factura = 'MXN' THEN RETURN round(p_monto * p_tc_pago, 4); END IF;
  -- Cruce USD<->EUR: pagos_proveedor no almacena TC cruzado; se excluye.
  RETURN NULL;
END;
$$;
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

CREATE OR REPLACE FUNCTION public.a_mxn(p_monto numeric, p_moneda text, p_usd_mxn numeric, p_eur_mxn numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL THEN NULL
    WHEN p_moneda = 'MXN' THEN p_monto
    -- M-8: > 1 (no > 0). En México el T/C se maneja como pesos por dólar/euro,
    -- así que 1 o menos nunca es un tipo de cambio real.
    WHEN p_moneda = 'USD' AND COALESCE(p_usd_mxn, 0) > 1 THEN round(p_monto * p_usd_mxn, 4)
    WHEN p_moneda = 'EUR' AND COALESCE(p_eur_mxn, 0) > 1 THEN round(p_monto * p_eur_mxn, 4)
    ELSE NULL
  END
$function$;

CREATE OR REPLACE FUNCTION public.tc_para_documento(_fecha date, _moneda text, _tc_documento numeric DEFAULT NULL::numeric, _tc_embarque numeric DEFAULT NULL::numeric)
 RETURNS TABLE(tc numeric, origen text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda text := UPPER(COALESCE(_moneda, 'MXN'));
  v_dof numeric;
BEGIN
  IF v_moneda = 'MXN' THEN
    RETURN QUERY SELECT 1::numeric, 'mxn'::text;
    RETURN;
  END IF;

  IF COALESCE(_tc_documento, 0) > 1 THEN
    RETURN QUERY SELECT _tc_documento::numeric, 'cfdi'::text;
    RETURN;
  END IF;

  IF _fecha IS NOT NULL THEN
    SELECT CASE WHEN v_moneda = 'USD' THEN d.usd_mxn
                WHEN v_moneda = 'EUR' THEN d.eur_mxn END
      INTO v_dof
    FROM public.tc_dof_vigente(_fecha) d;

    IF COALESCE(v_dof, 0) > 1 THEN
      RETURN QUERY SELECT v_dof::numeric, 'dof'::text;
      RETURN;
    END IF;
  END IF;

  IF COALESCE(_tc_embarque, 0) > 1 THEN
    RETURN QUERY SELECT _tc_embarque::numeric, 'embarque'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::numeric, 'sin_tc'::text;
END;
$function$;

-- Synthetic read-only-report tests; no app identity, data, or remote services.
CREATE FUNCTION pg_temp.snapshot() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object(
   'embarques',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM embarques x),
   'conceptos_venta',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM conceptos_venta x),
   'conceptos_costo',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM conceptos_costo x),
   'seguros',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM seguros_embarque x),
   'facturas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM facturas x),
   'conceptos_factura',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM conceptos_factura x),
   'factura_nc',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM factura_notas_credito x),
   'proveedor_facturas',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM proveedor_facturas x),
   'asignaciones',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM proveedor_facturas_conceptos x),
   'proveedor_nc',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM proveedor_notas_credito x),
   'pagos',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM pagos_proveedor x)
 )
$$;
