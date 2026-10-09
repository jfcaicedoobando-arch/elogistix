-- Forward container compatibility guard. No Drizzle/replay/history rewriting.
-- Reviewed draft SHA256 9c1c1871d7f365fa1981a5cec3b28bfdf0f5fe53f76ea07578dbdeeb9295c98f.
-- Function body is byte-exact to that reviewed draft. No helper or data backfill.
-- Requires one caller-owned transaction and ON_ERROR_STOP for this entire file.
-- SAVEPOINT refuses autocommit before changes. No transaction commit is owned here.
-- Known predecessor OR identical guarded body only; exact existing ACL/owner required.
SAVEPOINT pricing_container_immutable_forward;
DO $pricing_container_pre$
DECLARE
  v_snapshot jsonb;
  v_oid oid := pg_catalog.to_regprocedure('public.crm_aplicar_tarifa_tarifario(uuid,uuid)');
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_owner oid := pg_catalog.to_regrole('postgres');
  v_auth oid := pg_catalog.to_regrole('authenticated');
  v_service oid := pg_catalog.to_regrole('service_role');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_hash text;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_owner IS NULL OR v_auth IS NULL OR v_service IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: existing postgres owner and exact client roles required';
  END IF;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: target must already exist';
  END IF;
  SELECT * INTO STRICT v_proc FROM pg_catalog.pg_proc WHERE oid=v_oid;
  IF v_proc.proowner IS DISTINCT FROM v_owner OR v_proc.prokind <> 'f'
     OR v_proc.pronamespace <> 'public'::regnamespace OR NOT v_proc.prosecdef
     OR v_proc.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
     OR v_proc.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
     OR v_proc.prorettype <> 'jsonb'::regtype OR v_proc.proretset
     OR v_proc.proisstrict OR v_proc.proleakproof
     OR v_proc.provolatile <> 'v' OR v_proc.proparallel <> 'u'
     OR v_proc.procost <> 100 OR v_proc.prorows <> 0 OR v_proc.prosupport <> 0
     OR v_proc.pronargs <> 2 OR v_proc.pronargdefaults <> 0
     OR v_proc.proargtypes <> '2950 2950'::oidvector
     OR v_proc.proargnames IS DISTINCT FROM ARRAY['p_solicitud_id','p_tarifa_id']::text[]
     OR v_proc.proallargtypes IS NOT NULL OR v_proc.proargmodes IS NOT NULL
     OR v_proc.proargdefaults IS NOT NULL OR v_proc.provariadic <> 0
     OR v_proc.probin IS NOT NULL OR v_proc.prosqlbody IS NOT NULL THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: unexpected owner, signature or attributes';
  END IF;
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex');
  IF v_hash NOT IN ('2ec27dcc73f65c294b5d147d4eb4c2aaebef89f4000233c99bdc624076d0cf6d','30f6bf09d3098b3494ca1655b3dac6cfa1f71e185d5fbff1fa4117735a77b97e') THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: unreviewed target body';
  END IF;
  IF v_proc.proacl IS NULL
     OR (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl)) <> 3
     OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor <> v_owner OR a.is_grantable OR a.privilege_type <> 'EXECUTE'
          OR a.grantee NOT IN (v_owner,v_auth,v_service))
     OR (SELECT count(DISTINCT a.grantee) FROM pg_catalog.aclexplode(v_proc.proacl) a
       WHERE a.grantor=v_owner AND a.grantee IN (v_owner,v_auth,v_service)
         AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 3
     OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE')
     OR pg_catalog.has_function_privilege(v_auth,v_oid,'EXECUTE WITH GRANT OPTION')
     OR pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE WITH GRANT OPTION')
     OR NOT pg_catalog.has_function_privilege(v_auth,v_oid,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege(v_service,v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_PRECONDITION: exact existing owner/authenticated/service_role ACL required';
  END IF;
  EXECUTE $capture$SELECT pg_catalog.jsonb_build_object(
  'function', to_jsonb(p)-'prosrc',
  'acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.aclexplode(p.proacl) a),
  'effective', (SELECT jsonb_agg(jsonb_build_object('role_oid',r.oid,'role',r.rolname,
    'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION'))
    ORDER BY r.oid) FROM pg_catalog.pg_roles r)
) FROM pg_catalog.pg_proc p WHERE p.oid=$1$capture$ INTO v_snapshot USING v_oid;
  PERFORM pg_catalog.set_config('librecarga.pricing_container_snapshot',v_snapshot::text,true);
  PERFORM pg_catalog.set_config('librecarga.pricing_container_txid',pg_catalog.pg_current_xact_id()::text,true);
END
$pricing_container_pre$;

CREATE OR REPLACE FUNCTION public.crm_aplicar_tarifa_tarifario(p_solicitud_id uuid, p_tarifa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record;
  t record;
  v_pedido text;
  v_tipo_code text;
  v_tipo_name text;
  v_compatible boolean;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing
   WHERE id = p_solicitud_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.solicitante_id IS DISTINCT FROM auth.uid() AND v.created_by IS DISTINCT FROM auth.uid()
     AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;

  -- The form persists tipo_carga. container_size is a legacy fallback only.
  v_pedido := coalesce(
    nullif(regexp_replace(v.tipo_carga, '^\s+|\s+$', '', 'g'), ''),
    nullif(regexp_replace(v.container_size, '^\s+|\s+$', '', 'g'), ''));
  IF v_pedido IS NULL THEN
    RAISE EXCEPTION 'LC_PRICING_CONTENEDOR_REQUERIDO' USING ERRCODE = 'P0001';
  END IF;
  SELECT tc.code, tc.name INTO v_tipo_code, v_tipo_name
    FROM public.costeo_tarifas ct
    JOIN public.tipos_contenedor tc ON tc.id = ct.tipo_contenedor_id
   WHERE ct.id = p_tarifa_id AND ct.organization_id = v.organization_id
   FOR SHARE OF ct, tc;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE = 'P0001';
  END IF;

  -- Mirror claveCanonicaTipoContenedor without adding a public helper or ACL.
  -- A full semantic key accepts aliases, but never substitutes dry for HC.
  -- Raw keys preserve the shared helper's normalized-name-first priority.
  -- Conflicting known code/name size or category and empty raw keys fail closed.
  WITH entradas AS (
    SELECT 'pedido'::text AS fuente, v_pedido AS nombre, ''::text AS codigo
    UNION ALL
    SELECT 'tarifa', v_tipo_name, v_tipo_code
    UNION ALL
    SELECT 'tarifa_codigo', '', v_tipo_code
    UNION ALL
    SELECT 'tarifa_nombre', v_tipo_name, ''
  ), normalizados AS (
    SELECT fuente,
      btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(nombre, ''), NFD),
        U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) AS nombre,
      btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(codigo, ''), NFD),
        U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g')) AS codigo
    FROM entradas
  ), separados AS (
    SELECT *, regexp_replace(regexp_replace(btrim(nombre || ' ' || codigo),
      '([0-9]+)([a-z]+)', '\1 \2', 'g'), '([a-z]+)([0-9]+)', '\1 \2', 'g') AS texto
    FROM normalizados
  ), categorias AS (
    SELECT *, (regexp_match(texto, '\m(20|40|45|53)\M'))[1] AS tamano,
      CASE
        WHEN texto ~ '\m(reefer|refrigerad[[:alnum:]_]*|rf)\M' THEN 'reefer'
        WHEN texto ~ '\m(high cube|highcube|hc|hq)\M' THEN 'hc'
        WHEN texto ~ '\m(open top|opentop|ot)\M' THEN 'opentop'
        WHEN texto ~ '\m(flat rack|flatrack|fr)\M' THEN 'flatrack'
        WHEN texto ~ '\m(iso tank|tank|tanque)\M' THEN 'tank'
        WHEN texto ~ '\m(platform|plataforma)\M' THEN 'platform'
        WHEN texto ~ '\m(dry|standard|std|estandar|st|dv|gp)\M' THEN 'dry'
      END AS categoria
    FROM separados
  ), claves AS (
    SELECT *, CASE WHEN tamano IS NOT NULL AND categoria IS NOT NULL
      THEN tamano || '|' || categoria
      ELSE 'raw:' || coalesce(nullif(nombre, ''), codigo) END AS clave
    FROM categorias
  )
  SELECT pedido.clave = tarifa.clave
    AND pedido.clave <> 'raw:' AND tarifa.clave <> 'raw:'
    AND NOT (codigo.tamano IS NOT NULL AND nombre.tamano IS NOT NULL
      AND codigo.tamano <> nombre.tamano)
    AND NOT (codigo.categoria IS NOT NULL AND nombre.categoria IS NOT NULL
      AND codigo.categoria <> nombre.categoria)
    INTO v_compatible
    FROM claves pedido CROSS JOIN claves tarifa
    CROSS JOIN claves codigo CROSS JOIN claves nombre
   WHERE pedido.fuente = 'pedido' AND tarifa.fuente = 'tarifa'
     AND codigo.fuente = 'tarifa_codigo' AND nombre.fuente = 'tarifa_nombre';
  IF v_compatible IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'LC_TARIFA_CONTENEDOR_INCOMPATIBLE' USING ERRCODE = 'P0001';
  END IF;

  -- Recheck compatibility even for an idempotent call, without rewriting history.
  IF v.estado = 'respondida' AND v.tarifa_tarifario_id = p_tarifa_id THEN
    RETURN jsonb_build_object('id', v.id, 'ya_respondida', true);
  END IF;
  IF v.estado NOT IN ('borrador','enviada') THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.costeo_tarifas
   WHERE id = p_tarifa_id AND organization_id = v.organization_id AND estado = 'vigente'
     AND (vigente_hasta IS NULL OR vigente_hasta >= current_date);
  IF t.id IS NULL THEN RAISE EXCEPTION 'LC_TARIFA_NO_VIGENTE' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing
     SET tarifa_tarifario_id = p_tarifa_id, estado = 'respondida',
         enviada_at = coalesce(enviada_at, now()), respondida_at = now()
   WHERE id = p_solicitud_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  RETURN jsonb_build_object('id', v.id, 'ya_respondida', false);
END $$;

-- Reaffirm only the grants already proven above; never manufacture access.
REVOKE ALL ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_aplicar_tarifa_tarifario(uuid,uuid) TO authenticated, service_role;

DO $pricing_container_post$
DECLARE
  v_oid oid := pg_catalog.to_regprocedure('public.crm_aplicar_tarifa_tarifario(uuid,uuid)');
  v_after jsonb;
  v_before jsonb := nullif(current_setting('librecarga.pricing_container_snapshot',true),'')::jsonb;
  v_hash text;
BEGIN
  IF v_before IS NULL OR current_setting('librecarga.pricing_container_txid',true)
      IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_INVARIANT: caller-owned transaction required';
  END IF;
  EXECUTE $capture$SELECT pg_catalog.jsonb_build_object(
  'function', to_jsonb(p)-'prosrc',
  'acl', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.aclexplode(p.proacl) a),
  'effective', (SELECT jsonb_agg(jsonb_build_object('role_oid',r.oid,'role',r.rolname,
    'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION'))
    ORDER BY r.oid) FROM pg_catalog.pg_roles r)
) FROM pg_catalog.pg_proc p WHERE p.oid=$1$capture$ INTO v_after USING v_oid;
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(prosrc,'UTF8')),'hex')
    INTO v_hash FROM pg_catalog.pg_proc WHERE oid=v_oid;
  IF v_after IS DISTINCT FROM v_before OR v_hash IS DISTINCT FROM '30f6bf09d3098b3494ca1655b3dac6cfa1f71e185d5fbff1fa4117735a77b97e' THEN
    RAISE EXCEPTION 'PRICING_CONTAINER_INVARIANT: target identity, attributes, ACL or expected body changed';
  END IF;
  PERFORM pg_catalog.set_config('librecarga.pricing_container_snapshot','',true);
  PERFORM pg_catalog.set_config('librecarga.pricing_container_txid','',true);
END
$pricing_container_post$;
RELEASE SAVEPOINT pricing_container_immutable_forward;
