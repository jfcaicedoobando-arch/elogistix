-- Synthetic owned disposable cluster. No remote data, role/grant or RLS changes.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT NULLIF(current_setting('test.actor', true), '')::uuid
$$;
CREATE TYPE public.app_role AS ENUM ('admin','admin_org','operador','contador','viewer','super_admin');
CREATE FUNCTION public.current_user_org_id() RETURNS uuid LANGUAGE sql STABLE AS $$
SELECT NULLIF(current_setting('test.org', true), '')::uuid
$$;
CREATE FUNCTION public.has_role(p_user uuid, p_role app_role) RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT p_user IS NOT NULL AND p_role::text = current_setting('test.actor_role', true)
$$;
CREATE TABLE public.facturas (
 id uuid PRIMARY KEY, organization_id uuid, estado text DEFAULT 'Borrador',
 subtotal numeric DEFAULT 77, iva numeric DEFAULT 77, ret_isr numeric DEFAULT 77,
 ret_iva numeric DEFAULT 77, total numeric DEFAULT 77,
 deleted_at timestamptz, updated_at timestamptz DEFAULT '2000-01-01 UTC'
);
CREATE TABLE public.conceptos_factura (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), factura_id uuid, organization_id uuid,
 cantidad numeric, precio_unitario numeric, tasa_iva_aplicada numeric, tipo_iva text,
 monto_ret_isr numeric, monto_ret_iva numeric, deleted_at timestamptz
);
CREATE TABLE public.embarques (
 id uuid PRIMARY KEY, organization_id uuid, estado text DEFAULT 'Abierto',
 tipo_cambio_usd numeric DEFAULT 18, tipo_cambio_eur numeric DEFAULT 20,
 deleted_at timestamptz, updated_at timestamptz DEFAULT '2000-01-01 UTC'
);
CREATE TABLE public.test_dof(fecha date, usd_mxn numeric, eur_mxn numeric);
-- Purposefully replace only external DOF data/I/O with a deterministic fixture.
-- The optional delay lets two real sessions interleave at DOF lookup.
CREATE FUNCTION public.tc_dof_vigente(p_fecha date)
RETURNS TABLE(fecha date, usd_mxn numeric, eur_mxn numeric) LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('test.dof_delay',true) = 'yes' THEN
  PERFORM pg_sleep(2);
 END IF;
 RETURN QUERY SELECT d.fecha,d.usd_mxn,d.eur_mxn FROM public.test_dof d
 WHERE d.fecha <= p_fecha ORDER BY d.fecha DESC LIMIT 1;
END;
$$;
CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END;
$$;
CREATE FUNCTION public.test_expect_error(stmt text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = expected THEN RAISE NOTICE 'PASS: % [%]',label,SQLSTATE; RETURN; END IF;
  RAISE EXCEPTION 'FAIL: % expected %, got %: %',label,expected,SQLSTATE,SQLERRM;
 END;
 RAISE EXCEPTION 'FAIL: % did not throw %',label,expected;
END;
$$;
