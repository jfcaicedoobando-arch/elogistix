-- Release49 packaging envelope. The staged source below is preserved literally.
-- Reviewed source SHA256: 2a3ee94273fdfd7730c5c54acf1c52e598237ff1c868eb25d421eb631748643d
-- Historical LOCAL CANDIDATE comments inside that source describe its provenance.
-- Requires one caller-owned transaction and stop-on-error for this whole file.
-- SAVEPOINT refuses autocommit before persistent changes; no BEGIN or COMMIT here.
-- Requires reviewed existing bodies and postgres owner/grantor; never creates access.
-- service_role is never granted or revoked. Unknown ACLs/metadata fail closed.
-- Runtime of this new envelope must be verified in exact-commit CI before application.
SAVEPOINT restore49_immutable_forward;
DO $restore49_pre$
DECLARE
  v_spec CONSTANT jsonb := $restore49_spec$[{"signature":"public.list_trash(text,integer,integer)","private_trigger":false,"before_sha256":"f121b65e081df7977f02f4ee45f7720b1fe5d9426cb711b96847033db71e3085","after_sha256":"37156604926923420499bfeba6b921d9c9ad0343b371de32002c5260be5c75fd","config":["search_path=public"],"result":"TABLE(id uuid, organization_id uuid, deleted_at timestamp with time zone, deleted_by uuid, deleted_by_email text, label text)","strict":false,"defaults":"50, 0","language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":true,"identity_arguments":"_table text, _limit integer, _offset integer"},{"signature":"public.restore_record(text,uuid)","private_trigger":false,"before_sha256":"7a4d75bfcce42d78d92a03ea128eedf2e9eb9b82be696fd1de1319a27a9d4c36","after_sha256":"95673738af0796daa5fdb0eb3719b965aca24b27a331616e756f973a399d9284","config":["search_path=public"],"result":"void","strict":false,"defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"identity_arguments":"_table text, _id uuid"}]$restore49_spec$::jsonb;
  v_capture CONSTANT text := $restore49_capture$SELECT pg_catalog.jsonb_build_object(
  'functions', (SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid)
    FROM pg_catalog.pg_proc p WHERE p.oid=ANY($1)),
  'acl', (SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'entry',to_jsonb(a))
    ORDER BY p.oid,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid=ANY($1)),
  'effective', (SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'role_oid',r.oid,
    'role',r.rolname,'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION'))
    ORDER BY p.oid,r.rolname) FROM pg_catalog.pg_proc p CROSS JOIN pg_catalog.pg_roles r
    WHERE p.oid=ANY($1))
)$restore49_capture$;
  v_item jsonb;
  v_oid oid;
  v_oids oid[] := ARRAY[]::oid[];
  v_owner oid;
  v_authenticated oid := pg_catalog.to_regrole('authenticated');
  v_anon oid := pg_catalog.to_regrole('anon');
  v_service oid := pg_catalog.to_regrole('service_role');
  v_proc pg_catalog.pg_proc%ROWTYPE;
  v_source_hash text;
  v_before jsonb;
BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
     OR v_authenticated IS NULL OR v_anon IS NULL THEN
    RAISE EXCEPTION 'FIN49_PRECONDITION: existing postgres execution identity and client roles required';
  END IF;
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_spec) LOOP
    v_oid := pg_catalog.to_regprocedure(v_item->>'signature');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: target function must already exist: %',v_item->>'signature';
    END IF;
    SELECT p.* INTO STRICT v_proc FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
    v_owner := v_proc.proowner;
    IF v_owner IS DISTINCT FROM pg_catalog.to_regrole(current_user)::oid
       OR v_proc.proacl IS NULL OR v_proc.prokind <> 'f'
       OR v_proc.pronamespace <> 'public'::regnamespace OR NOT v_proc.prosecdef
       OR v_proc.prolang <> (SELECT oid FROM pg_catalog.pg_language WHERE lanname=v_item->>'language')
       OR pg_catalog.to_jsonb(v_proc.proconfig) IS DISTINCT FROM v_item->'config'
       OR pg_catalog.pg_get_function_result(v_oid) IS DISTINCT FROM v_item->>'result'
       OR pg_catalog.pg_get_function_identity_arguments(v_oid) IS DISTINCT FROM v_item->>'identity_arguments'
       OR pg_catalog.pg_get_expr(v_proc.proargdefaults,0) IS DISTINCT FROM v_item->>'defaults'
       OR v_proc.proisstrict IS DISTINCT FROM (v_item->>'strict')::boolean
       OR v_proc.proretset IS DISTINCT FROM (v_item->>'returns_set')::boolean
       OR v_proc.proleakproof IS DISTINCT FROM (v_item->>'leakproof')::boolean
       OR v_proc.proparallel::text IS DISTINCT FROM v_item->>'parallel'
       OR v_proc.provolatile::text IS DISTINCT FROM v_item->>'volatility' THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: unexpected target owner, signature or attributes: %',v_item->>'signature';
    END IF;
    v_source_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_proc.prosrc,'UTF8')),'hex');
    -- Exact historical list_trash body: three extra empty code lines, no token changes.
    IF v_source_hash NOT IN (v_item->>'before_sha256',v_item->>'after_sha256')
       AND NOT (v_item->>'signature' = 'public.list_trash(text,integer,integer)'
         AND v_source_hash = 'e22add636e68c503bd302cd7711db80be628a4f228e5cb46a20512a717835c5f') THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: unreviewed target body: %',v_item->>'signature';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
        WHERE a.grantee=0 OR a.grantee=v_anon)
       OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE')
       OR pg_catalog.has_function_privilege(v_anon,v_oid,'EXECUTE WITH GRANT OPTION') THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: PUBLIC and anon must already be closed';
    END IF;
    IF (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl) a
        WHERE a.grantee=v_owner AND a.grantor=v_owner
          AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 1
       OR EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a
        WHERE a.grantor<>v_owner OR a.is_grantable OR a.privilege_type<>'EXECUTE'
           OR NOT (a.grantee=v_owner OR a.grantee=v_authenticated
                   OR (v_service IS NOT NULL AND a.grantee=v_service))) THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: unexpected ACL role, grantor or grant option';
    END IF;
    IF (v_item->>'private_trigger')::boolean THEN
      IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_proc.proacl) a WHERE a.grantee=v_authenticated)
         OR pg_catalog.has_function_privilege(v_authenticated,v_oid,'EXECUTE')
         OR pg_catalog.has_function_privilege(v_authenticated,v_oid,'EXECUTE WITH GRANT OPTION') THEN
        RAISE EXCEPTION 'FIN49_PRECONDITION: trigger must already be private to client roles';
      END IF;
    ELSIF (SELECT count(*) FROM pg_catalog.aclexplode(v_proc.proacl) a
        WHERE a.grantee=v_authenticated AND a.grantor=v_owner
          AND a.privilege_type='EXECUTE' AND NOT a.is_grantable) <> 1 THEN
      RAISE EXCEPTION 'FIN49_PRECONDITION: matching direct authenticated grant required';
    END IF;
    v_oids := pg_catalog.array_append(v_oids,v_oid);
  END LOOP;
  EXECUTE v_capture INTO v_before USING v_oids;
  PERFORM pg_catalog.set_config('librecarga.restore49_snapshot',v_before::text,true);
  PERFORM pg_catalog.set_config('librecarga.restore49_txid',pg_catalog.pg_current_xact_id()::text,true);
END
$restore49_pre$;

-- BEGIN BYTE-EXACT REVIEWED SOURCE
-- LOCAL CANDIDATE ONLY: no release assignment or migration registration.
-- Replace only the existing insurance branches. No grants, schema/data changes or new RPC.
-- Insurance has no deletion-actor column: list unknown actor as NULL.
CREATE OR REPLACE FUNCTION public.list_trash(_table text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, organization_id uuid, deleted_at timestamp with time zone, deleted_by uuid, deleted_by_email text, label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _scope uuid;
  _label_col text;
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sólo admin / super_admin';
  END IF;

  _scope := public.org_scope();
  IF _scope IS NULL THEN
    RETURN;  -- super admin sin tenant activo: nunca mezclar organizaciones
  END IF;

  _label_col := CASE _table
    WHEN 'clientes' THEN 'nombre'
    WHEN 'contactos_cliente' THEN 'nombre'
    WHEN 'embarques' THEN 'expediente'
    WHEN 'documentos_embarque' THEN 'nombre'
    WHEN 'eventos_embarque' THEN 'descripcion'
    WHEN 'notas_embarque' THEN 'contenido'
    WHEN 'cotizaciones' THEN 'folio'
    WHEN 'cotizacion_costos' THEN 'concepto'
    WHEN 'facturas' THEN 'numero'
    WHEN 'conceptos_factura' THEN 'descripcion'
    WHEN 'proformas' THEN 'numero'
    WHEN 'proforma_conceptos_consolidados' THEN 'descripcion'
    WHEN 'conceptos_costo' THEN 'concepto'
    WHEN 'conceptos_venta' THEN 'descripcion'
    WHEN 'crm_leads' THEN 'empresa'
    WHEN 'crm_oportunidades' THEN 'nombre'
    WHEN 'crm_actividades' THEN 'asunto'
    WHEN 'crm_comentarios_oportunidad' THEN 'texto'
    WHEN 'crm_etapas_pipeline' THEN 'nombre'
    WHEN 'crm_motivos_perdida' THEN 'nombre'
    WHEN 'crm_plantillas_mensaje' THEN 'nombre'
    WHEN 'pagos_factura' THEN 'referencia'
    WHEN 'pagos_proveedor' THEN 'referencia'
    WHEN 'proveedor_facturas' THEN 'folio_interno'
    WHEN 'proveedor_notas_credito' THEN 'descripcion'
    WHEN 'factura_notas_credito' THEN 'folio'
    WHEN 'cuentas_bancarias' THEN 'alias'
    WHEN 'seguros_embarque' THEN 'numero_poliza'
    WHEN 'embarque_contenedores' THEN 'numero_contenedor'
    ELSE 'id'
  END;

  IF _table = 'seguros_embarque' THEN
    RETURN QUERY
      SELECT t.id, t.organization_id, t.deleted_at,
             NULL::uuid AS deleted_by, NULL::text AS deleted_by_email,
             COALESCE(NULLIF(t.numero_poliza::text, ''), '(sin etiqueta)') AS label
      FROM public.seguros_embarque t
      WHERE t.deleted_at IS NOT NULL
        AND t.organization_id = _scope
      ORDER BY t.deleted_at DESC
      LIMIT _limit OFFSET _offset;
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT t.id, t.organization_id, t.deleted_at, t.deleted_by,
            (SELECT u.email::text FROM auth.users u WHERE u.id = t.deleted_by) AS deleted_by_email,
            COALESCE(NULLIF(t.%I::text, %L), %L) AS label
     FROM public.%I t
     WHERE t.deleted_at IS NOT NULL
       AND t.organization_id = $1
     ORDER BY t.deleted_at DESC
     LIMIT $2 OFFSET $3',
    _label_col, '', '(sin etiqueta)', _table
  ) USING _scope, _limit, _offset;
END $function$;

CREATE OR REPLACE FUNCTION public.restore_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $_$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF _table = 'embarques' THEN
    PERFORM public.restaurar_embarque_cascade(_id);
    RETURN;
  END IF;
  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _table)
    INTO _org USING _id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado en papelera';
  END IF;
  IF _org IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_ORG_FUERA_DE_SCOPE: el registro pertenece a otra organización';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;
  -- D-01: puerta oficial de restauración.
  PERFORM set_config('app.papelera_restore', 'on', true);
  IF _table = 'seguros_embarque' THEN
    UPDATE public.seguros_embarque SET deleted_at = NULL WHERE id = _id;
  ELSE
    EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _table)
      USING _id;
  END IF;
  PERFORM set_config('app.papelera_restore', 'off', true);
END;
$_$;
-- END BYTE-EXACT REVIEWED SOURCE

-- These statements are no-ops under the checked precondition. Preserve exact ACL.
REVOKE ALL ON FUNCTION public.list_trash(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trash(text,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.restore_record(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_record(text,uuid) TO authenticated;
DO $restore49_post$
DECLARE
  v_spec CONSTANT jsonb := $restore49_spec$[{"signature":"public.list_trash(text,integer,integer)","private_trigger":false,"before_sha256":"f121b65e081df7977f02f4ee45f7720b1fe5d9426cb711b96847033db71e3085","after_sha256":"37156604926923420499bfeba6b921d9c9ad0343b371de32002c5260be5c75fd","config":["search_path=public"],"result":"TABLE(id uuid, organization_id uuid, deleted_at timestamp with time zone, deleted_by uuid, deleted_by_email text, label text)","strict":false,"defaults":"50, 0","language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":true,"identity_arguments":"_table text, _limit integer, _offset integer"},{"signature":"public.restore_record(text,uuid)","private_trigger":false,"before_sha256":"7a4d75bfcce42d78d92a03ea128eedf2e9eb9b82be696fd1de1319a27a9d4c36","after_sha256":"95673738af0796daa5fdb0eb3719b965aca24b27a331616e756f973a399d9284","config":["search_path=public"],"result":"void","strict":false,"defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"volatility":"v","returns_set":false,"identity_arguments":"_table text, _id uuid"}]$restore49_spec$::jsonb;
  v_capture CONSTANT text := $restore49_capture$SELECT pg_catalog.jsonb_build_object(
  'functions', (SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid)
    FROM pg_catalog.pg_proc p WHERE p.oid=ANY($1)),
  'acl', (SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'entry',to_jsonb(a))
    ORDER BY p.oid,a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    FROM pg_catalog.pg_proc p CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) a
    WHERE p.oid=ANY($1)),
  'effective', (SELECT jsonb_agg(jsonb_build_object('oid',p.oid,'role_oid',r.oid,
    'role',r.rolname,'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'),
    'grant_option',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION'))
    ORDER BY p.oid,r.rolname) FROM pg_catalog.pg_proc p CROSS JOIN pg_catalog.pg_roles r
    WHERE p.oid=ANY($1))
)$restore49_capture$;
  v_item jsonb;
  v_oid oid;
  v_oids oid[] := ARRAY[]::oid[];
  v_before jsonb;
  v_after jsonb;
  v_source_hash text;
BEGIN
  IF pg_catalog.current_setting('librecarga.restore49_txid',true)
     IS DISTINCT FROM pg_catalog.pg_current_xact_id()::text THEN
    RAISE EXCEPTION 'FIN49_TRANSACTION: pre/post checks must share the caller transaction';
  END IF;
  v_before := NULLIF(pg_catalog.current_setting('librecarga.restore49_snapshot',true),'')::jsonb;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'FIN49_TRANSACTION: missing transaction-local target snapshot';
  END IF;
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(v_spec) LOOP
    v_oid := pg_catalog.to_regprocedure(v_item->>'signature');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'FIN49_INVARIANT: target function missing';
    END IF;
    v_oids := pg_catalog.array_append(v_oids,v_oid);
    SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')
      INTO v_source_hash FROM pg_catalog.pg_proc p WHERE p.oid=v_oid;
    IF v_source_hash IS DISTINCT FROM v_item->>'after_sha256' THEN
      RAISE EXCEPTION 'FIN49_INVARIANT: target body differs: %',v_item->>'signature';
    END IF;
  END LOOP;
  EXECUTE v_capture INTO v_after USING v_oids;
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'FIN49_INVARIANT: target identity, nonbody metadata or privileges changed';
  END IF;
  PERFORM pg_catalog.set_config('librecarga.restore49_snapshot','',true);
  PERFORM pg_catalog.set_config('librecarga.restore49_txid','',true);
END
$restore49_post$;
RELEASE SAVEPOINT restore49_immutable_forward;
