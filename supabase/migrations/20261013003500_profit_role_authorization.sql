BEGIN;
-- Fail closed on source/catalog drift; never silently normalize an unknown ACL.
DO $catalog$
DECLARE v_before jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
    WHERE p.oid = to_regprocedure('public.profit_por_cliente(date,date,text,uuid)')
      AND pg_get_userbyid(p.proowner) = 'postgres'
      AND p.prosecdef AND p.provolatile = 's'
      AND p.proconfig = ARRAY['search_path=public']::text[]
      AND p.proacl @> '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
      AND p.proacl <@ '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
      AND ((l.lanname = 'sql' AND md5(p.prosrc) = '9053d1f0460b37d73c768cacab5621c0')
        OR (l.lanname = 'plpgsql' AND md5(p.prosrc) = '7c71af8e2d3db9a61489f135b13b3d5f'))
  ) THEN
    RAISE EXCEPTION 'PROFIT_AUTH_PRECONDITION: unreviewed source, owner, ACL or security attributes';
  END IF;
  SELECT to_jsonb(p) - 'prosrc' - 'prolang' INTO v_before
  FROM pg_proc p WHERE p.oid = 'public.profit_por_cliente(date,date,text,uuid)'::regprocedure;
  PERFORM set_config('elogistix.profit_auth_catalog', v_before::text, true);
END $catalog$;

-- Financial authorization at the SECURITY DEFINER entry point.
-- Preserve signature, volatility, owner, ACL and all financial expressions.
CREATE OR REPLACE FUNCTION public.profit_por_cliente(_fecha_desde date DEFAULT NULL::date, _fecha_hasta date DEFAULT NULL::date, _modo text DEFAULT NULL::text, _cliente_id uuid DEFAULT NULL::uuid) RETURNS TABLE(cliente_id uuid, cliente_nombre text, total_embarques bigint, venta_usd numeric, costo_usd numeric, venta_mxn numeric, costo_mxn numeric, embarques_sin_tc bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := public.org_scope();
  v_global_role text;
  v_org_role text;
  v_effective_role text;
BEGIN
  -- No new service bypass: the existing no-UID/no-scope call remains empty.
  IF v_uid IS NULL THEN
    IF current_setting('role', true) = 'service_role' AND v_org IS NULL THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'LC_PROFIT_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Exact global role, with the existing get_user_context priority. Do not use
  -- has_role: its hierarchy must not add roles to this financial allowlist.
  SELECT ur.role::text INTO v_global_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid
  ORDER BY CASE ur.role::text
    WHEN 'super_admin' THEN 1 WHEN 'admin_org' THEN 2 WHEN 'admin' THEN 3
    WHEN 'gerente_operaciones' THEN 4 WHEN 'contador' THEN 5 WHEN 'tesorero' THEN 6
    WHEN 'ejecutivo_pricing' THEN 7 WHEN 'coordinador_logistico' THEN 8
    WHEN 'operador' THEN 9 WHEN 'vendedor' THEN 10 WHEN 'customer_service' THEN 11
    WHEN 'viewer' THEN 12 WHEN 'cliente' THEN 13 ELSE 99
  END, ur.role::text
  LIMIT 1;

  IF v_global_role = 'super_admin' THEN
    -- A platform role is never a cross-tenant financial scope.
    IF v_org IS NULL THEN
      RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organizations o
                   WHERE o.id = v_org AND o.activo IS TRUE) THEN
      RAISE EXCEPTION 'LC_PROFIT_ORG_REQUIRED' USING ERRCODE = '42501';
    END IF;
    v_effective_role := v_global_role;
  ELSE
    -- Membership has no active/status column. Present membership in an active
    -- organization is required; a global role cannot revive a missing member.
    SELECT om.role::text INTO v_org_role
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = v_uid AND om.organization_id = v_org
      AND o.activo IS TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_PROFIT_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
    END IF;
    -- Match UI precedence only inside this tenant. A legacy tenant super_admin
    -- is not a platform grant; NULL is defensive (role is currently NOT NULL).
    v_effective_role := COALESCE(NULLIF(v_org_role, 'super_admin'), v_global_role);
  END IF;

  IF v_effective_role IS NULL OR NOT (v_effective_role = ANY (ARRAY[
    'admin', 'admin_org', 'super_admin', 'ejecutivo_pricing', 'contador',
    'tesorero', 'gerente_operaciones', 'gerente_comercial', 'gerente_visor',
    'auxiliar_contable'
  ]::text[])) THEN
    RAISE EXCEPTION 'LC_PROFIT_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.cliente_id,
      e.cliente_nombre,
      COALESCE(
        NULLIF(e.tipo_cambio_usd, 0),
        (SELECT d.usd_mxn FROM public.tc_dof_vigente(COALESCE(e.eta, e.etd, e.created_at::date)) d)
      ) AS tc_usd,
      COALESCE(
        NULLIF(e.tipo_cambio_eur, 0),
        (SELECT d.eur_mxn FROM public.tc_dof_vigente(COALESCE(e.eta, e.etd, e.created_at::date)) d)
      ) AS tc_eur
    FROM public.embarques e
    WHERE e.deleted_at IS NULL
      -- AUD-ANALISIS-1: alineado con Utilidad/Tablero/Cierre.
      AND e.estado NOT IN ('Cotización'::estado_embarque, 'Borrador'::estado_embarque, 'Cancelado'::estado_embarque)
      AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)
      AND (_fecha_hasta IS NULL OR e.eta <= _fecha_hasta)
      AND (_modo IS NULL OR e.modo::text = _modo)
      AND (_cliente_id IS NULL OR e.cliente_id = _cliente_id)
      AND (e.organization_id = v_org)
  ),
  ventas AS (
    SELECT v.embarque_id, SUM(v.venta_mxn) AS venta_mxn,
      COUNT(*) FILTER (WHERE v.venta_mxn IS NULL) AS venta_sin_tc
    FROM public._venta_facturada_por_embarque(v_org) v
    JOIN base b ON b.id = v.embarque_id
    GROUP BY v.embarque_id
  ),
  ncs AS (SELECT NULL::uuid AS embarque_id, 0::numeric AS nc_mxn WHERE false),
  costos AS (
    SELECT
      cc.embarque_id,
      SUM(public.a_mxn(cc.monto, cc.moneda::text, b.tc_usd, b.tc_eur)) AS costo_mxn,
      COUNT(*) FILTER (
        WHERE public.a_mxn(cc.monto, cc.moneda::text, b.tc_usd, b.tc_eur) IS NULL
      ) AS costo_sin_tc
    FROM public.conceptos_costo cc
    JOIN base b ON b.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id
  ),
  neto AS (
    SELECT
      b.id, b.cliente_id, b.cliente_nombre, b.tc_usd,
      GREATEST(COALESCE(v.venta_mxn, 0) - COALESCE(nc.nc_mxn, 0), 0) AS venta_mxn,
      COALESCE(c.costo_mxn, 0) AS costo_mxn,
      COALESCE(v.venta_sin_tc, 0) AS venta_sin_tc,
      COALESCE(c.costo_sin_tc, 0) AS costo_sin_tc
    FROM base b
    LEFT JOIN ventas v ON v.embarque_id = b.id
    LEFT JOIN costos c ON c.embarque_id = b.id
    LEFT JOIN ncs   nc ON nc.embarque_id = b.id
  )
  SELECT
    n.cliente_id,
    MAX(n.cliente_nombre) AS cliente_nombre,
    COUNT(DISTINCT n.id) AS total_embarques,
    COALESCE(SUM(CASE WHEN COALESCE(n.tc_usd, 0) > 0 THEN round(n.venta_mxn / n.tc_usd, 4) END), 0) AS venta_usd,
    COALESCE(SUM(CASE WHEN COALESCE(n.tc_usd, 0) > 0 THEN round(n.costo_mxn / n.tc_usd, 4) END), 0) AS costo_usd,
    COALESCE(SUM(n.venta_mxn), 0) AS venta_mxn,
    COALESCE(SUM(n.costo_mxn), 0) AS costo_mxn,
    COUNT(DISTINCT n.id) FILTER (
      WHERE COALESCE(n.tc_usd, 0) <= 0 OR n.venta_sin_tc > 0 OR n.costo_sin_tc > 0
    ) AS embarques_sin_tc
  FROM neto n
  GROUP BY n.cliente_id;
END;
$$;

-- Reassert exactly the catalog verified above, without expanding access.
REVOKE ALL ON FUNCTION public.profit_por_cliente(date, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profit_por_cliente(date, date, text, uuid) TO authenticated, service_role;

DO $catalog$
DECLARE v_after jsonb;
BEGIN
  SELECT to_jsonb(p) - 'prosrc' - 'prolang' INTO v_after
  FROM pg_proc p WHERE p.oid = 'public.profit_por_cliente(date,date,text,uuid)'::regprocedure;
  IF v_after IS DISTINCT FROM current_setting('elogistix.profit_auth_catalog')::jsonb
     OR NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
       WHERE p.oid = 'public.profit_por_cliente(date,date,text,uuid)'::regprocedure
         AND l.lanname = 'plpgsql' AND md5(p.prosrc) = '7c71af8e2d3db9a61489f135b13b3d5f') THEN
    RAISE EXCEPTION 'PROFIT_AUTH_POSTCONDITION: catalog or body changed unexpectedly';
  END IF;
END $catalog$;
COMMIT;
