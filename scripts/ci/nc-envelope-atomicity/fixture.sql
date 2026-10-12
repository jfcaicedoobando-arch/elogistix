-- ONLY a new disposable owned PostgreSQL17.6 cluster/database.
-- Empty structural fixture: no business rows or credentials.
DO $fixture$ BEGIN
 IF current_database() <> 'nc_envelope_test' OR current_setting('server_version_num')::int <> 170006 THEN
  RAISE EXCEPTION 'Disposable nc_envelope_test PostgreSQL17.6 required';
 END IF;
END $fixture$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TYPE public.estado_factura AS ENUM ('Borrador','Emitida','Parcialmente pagada','Pagada','Vencida','Cancelada','Sustituida');
CREATE TABLE public.facturas(id uuid PRIMARY KEY,total numeric,moneda text,tipo_cambio numeric,estado public.estado_factura,deleted_at timestamptz);
CREATE TABLE public.factura_notas_credito(id uuid PRIMARY KEY,factura_id uuid,monto numeric,moneda text,tipo_cambio numeric,estado text,deleted_at timestamptz);
CREATE TABLE public.pagos_factura(id uuid PRIMARY KEY,factura_id uuid,monto_aplicado_factura numeric,deleted_at timestamptz,estado_rep text);
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text,created_by text,idempotency_key text,rollback text[]);
CREATE OR REPLACE FUNCTION public._nc_aplicadas_moneda_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE
      WHEN nc.moneda::text = f.moneda::text THEN nc.monto
      WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
        THEN nc.monto * nc.tipo_cambio
      WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
        THEN nc.monto / f.tipo_cambio
      WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
           AND f.moneda::text <> nc.moneda::text
           AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
        THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
      ELSE 0
    END), 0)
  FROM public.facturas f
  JOIN public.factura_notas_credito nc
    ON nc.factura_id = f.id
   AND nc.deleted_at IS NULL
   AND nc.estado IN ('Timbrada','Aplicada')
  WHERE f.id = p_factura_id;
$function$;
REVOKE ALL ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._nc_aplicadas_moneda_factura(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_moneda text; v_tc numeric; v_estado estado_factura;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.moneda::text, f.tipo_cambio, f.estado
    INTO v_total, v_moneda, v_tc, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_estado IN ('Cancelada', 'Sustituida') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(p.estado_rep);

  SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
           nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda, v_tc)), 0)
    INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado IN ('Timbrada','Aplicada');

  RETURN COALESCE(v_total, 0) - COALESCE(v_pagos, 0) - COALESCE(v_ncs, 0);
END;
$function$;
REVOKE ALL ON FUNCTION public._saldo_factura_calc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._saldo_factura_calc(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public._nc_aplicadas_moneda_factura(p_factura_id);
$function$;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;
