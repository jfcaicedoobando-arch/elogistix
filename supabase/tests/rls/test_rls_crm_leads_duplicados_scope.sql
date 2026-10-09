-- Regresión de aislamiento de crm_leads_buscar_duplicados(jsonb).
-- Sólo PostgreSQL efímero, nunca Live. No modifica policies ni desactiva RLS.
-- El oráculo es SELECT de crm_leads bajo authenticated (SECURITY INVOKER),
-- no una copia del predicado de autorización que se está probando en la RPC.
-- Compara las nueve columnas y la multiplicidad, no sólo COUNT(*) o IDs.
BEGIN;

\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.assert_duplicados_visibles(
  p_claves jsonb,
  p_ids_esperados uuid[],
  p_caso text,
  p_rpc_service_role boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_oraculo jsonb;
  v_resultado jsonb;
  v_ids uuid[];
  v_ids_esperados uuid[];
BEGIN
  PERFORM pg_temp.assert(
    current_user = 'authenticated' AND row_security_active('public.crm_leads'),
    p_caso || ': el oráculo debe ejecutarse con RLS activo como authenticated');

  WITH claves AS (
    SELECT
      nullif(lower(regexp_replace(coalesce(c->>'empresa', ''), '[^a-z0-9]', '', 'gi')), '') AS empresa_norm,
      nullif(lower(trim(coalesce(c->>'email', ''))), '') AS email_norm,
      nullif(regexp_replace(coalesce(c->>'telefono', ''), '\D', '', 'g'), '') AS telefono_norm
    FROM jsonb_array_elements(coalesce(p_claves, '[]'::jsonb)) AS c
  ), visibles AS (
    SELECT
      l.id, l.empresa, l.contacto, l.email, l.telefono, l.estado,
      lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) AS empresa_norm,
      lower(trim(coalesce(l.email, ''))) AS email_norm,
      regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g') AS telefono_norm
    FROM public.crm_leads l
    WHERE l.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM claves k
        WHERE (k.email_norm IS NOT NULL
               AND lower(trim(coalesce(l.email, ''))) = k.email_norm)
           OR (k.telefono_norm IS NOT NULL AND length(k.telefono_norm) >= 8
               AND right(regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g'), 10)
                   = right(k.telefono_norm, 10))
           OR (k.empresa_norm IS NOT NULL AND length(k.empresa_norm) >= 4
               AND lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi'))
                   = k.empresa_norm)
      )
  )
  SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.id), '[]'::jsonb),
         coalesce(array_agg(v.id ORDER BY v.id), '{}'::uuid[])
    INTO v_oraculo, v_ids
    FROM visibles v;

  SELECT coalesce(array_agg(x ORDER BY x), '{}'::uuid[])
    INTO v_ids_esperados
    FROM unnest(p_ids_esperados) AS x;
  PERFORM pg_temp.assert(v_ids IS NOT DISTINCT FROM v_ids_esperados,
    format('%s: fixture/oráculo inesperado; visibles=%s, esperados=%s',
      p_caso, v_ids, v_ids_esperados));

  -- El oráculo anterior SIEMPRE tiene RLS de authenticated. Para el caso
  -- interno, sólo la llamada RPC usa service_role; sus privilegios de tabla
  -- no deben ampliar la visibilidad del usuario del JWT ni admitir UID nulo.
  IF p_rpc_service_role THEN
    PERFORM set_config('role', 'service_role', true);
    PERFORM pg_temp.assert(current_user = 'service_role',
      p_caso || ': la llamada interna debe usar el rol de base service_role');
  END IF;
  -- No filtrar la salida de la RPC por IDs del fixture: ocultaría una fuga.
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
    INTO v_resultado
    FROM public.crm_leads_buscar_duplicados(p_claves) r;
  IF p_rpc_service_role THEN
    PERFORM set_config('role', 'authenticated', true);
  END IF;
  PERFORM pg_temp.assert(v_resultado IS NOT DISTINCT FROM v_oraculo,
    format('%s: la RPC difiere del SELECT visible (filas, valores o duplicados); RPC=%s, SELECT=%s',
      p_caso, v_resultado, v_oraculo));
END;
$$;

DO $$
DECLARE
  fx record;
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_empresa text;
  v_keys jsonb;
  v_role public.app_role;
  v_user uuid;
  v_vendedor uuid := gen_random_uuid();
  v_sa uuid := gen_random_uuid();
  v_sin_membresia uuid := gen_random_uuid();
  v_global_obsoleto uuid := gen_random_uuid();
  v_sin_espejo uuid := gen_random_uuid();
  a_propio uuid := gen_random_uuid();
  a_ajeno uuid := gen_random_uuid();
  a_bolsa uuid := gen_random_uuid();
  a_borrado uuid := gen_random_uuid();
  a_no_match uuid := gen_random_uuid();
  a_corto uuid := gen_random_uuid();
  a_umbral uuid := gen_random_uuid();
  a_vacio uuid := gen_random_uuid();
  b_propio uuid := gen_random_uuid();
  b_ajeno uuid := gen_random_uuid();
  b_bolsa uuid := gen_random_uuid();
  b_borrado uuid := gen_random_uuid();
  v_a uuid[];
  v_b uuid[];
  v_esperados uuid[];
  v_matriz integer := 0;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('RLS DUPLICADOS');
  v_empresa := 'RLS Duplicados ' || v_token;
  v_a := ARRAY[a_propio, a_ajeno, a_bolsa];
  v_b := ARRAY[b_propio, b_ajeno, b_bolsa];
  v_keys := jsonb_build_array(
    jsonb_build_object('empresa', upper('RLS-Duplicados:' || v_token)),
    jsonb_build_object('empresa', v_empresa),
    jsonb_build_object('email', ' propio+' || v_token || '@EXAMPLE.INVALID '),
    jsonb_build_object('telefono', '+1 (55) 1200-3401')
  );

  PERFORM pg_temp.seed_auth_user(v_vendedor);
  PERFORM pg_temp.seed_auth_user(v_sa);
  PERFORM pg_temp.seed_auth_user(v_sin_membresia);
  PERFORM pg_temp.seed_auth_user(v_global_obsoleto);
  PERFORM pg_temp.seed_auth_user(v_sin_espejo);
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (fx.org_a, v_vendedor, 'vendedor'),
    (fx.org_a, v_global_obsoleto, 'cliente'),
    (fx.org_a, v_sin_espejo, 'customer_service');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (v_sa, 'super_admin'),
    (v_sin_membresia, 'gerente_comercial'),
    (v_global_obsoleto, 'admin_org')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  DELETE FROM public.user_roles WHERE user_id = v_sin_espejo;

  -- Las dos organizaciones comparten TODAS las claves de búsqueda. Dentro de
  -- cada una hay lead propio, de otro vendedor, bolsa y borrado recuperable.
  INSERT INTO public.crm_leads(
    id, organization_id, empresa, contacto, email, telefono, estado, vendedor_id, deleted_at
  ) VALUES
    (a_propio, fx.org_a, v_empresa, 'Propio A', ' Propio+' || v_token || '@Example.Invalid ', '+52 (55) 1200-3401', 'Nuevo', v_vendedor, NULL),
    (a_ajeno, fx.org_a, v_empresa, 'Ajeno A', 'ajeno+' || v_token || '@example.invalid', '+52 (55) 1200-3402', 'Contactado', fx.admin_a, NULL),
    (a_bolsa, fx.org_a, v_empresa, 'Bolsa A', 'bolsa+' || v_token || '@example.invalid', '+52 (55) 1200-3403', 'Descalificado', NULL, NULL),
    (a_borrado, fx.org_a, v_empresa, 'Borrado A', 'borrado+' || v_token || '@example.invalid', '+52 (55) 1200-3404', 'Nuevo', v_vendedor, now()),
    (b_propio, fx.org_b, v_empresa, 'Propio B', ' Propio+' || v_token || '@Example.Invalid ', '+52 (55) 1200-3401', 'Nuevo', fx.admin_b, NULL),
    (b_ajeno, fx.org_b, v_empresa, 'Ajeno B', 'ajeno+' || v_token || '@example.invalid', '+52 (55) 1200-3402', 'Contactado', fx.admin_b, NULL),
    (b_bolsa, fx.org_b, v_empresa, 'Bolsa B', 'bolsa+' || v_token || '@example.invalid', '+52 (55) 1200-3403', 'Descalificado', NULL, NULL),
    (b_borrado, fx.org_b, v_empresa, 'Borrado B', 'borrado+' || v_token || '@example.invalid', '+52 (55) 1200-3404', 'Nuevo', fx.admin_b, now()),
    (a_no_match, fx.org_a, 'Otra empresa ' || v_token, 'Sin coincidencia', 'otro+' || v_token || '@example.invalid', '9988776655', 'Nuevo', NULL, NULL),
    (a_corto, fx.org_a, 'A-bC', 'Claves cortas', '', '123-4567', 'Nuevo', NULL, NULL),
    (a_umbral, fx.org_a, 'A-b12', 'Claves mínimas', '', '12-345-678', 'Nuevo', NULL, NULL),
    (a_vacio, fx.org_a, ' --- ', 'Claves vacías', '   ', '()', 'Nuevo', NULL, NULL);

  -- Toda la jerarquía vigente y ambos roles de portal denegados. Legacy se
  -- prepara con UPDATE permitido: no desactivar el guard de INSERT ni RLS.
  FOREACH v_role IN ARRAY ARRAY[
    'admin', 'admin_org', 'gerente_comercial', 'vendedor', 'viewer', 'operador',
    'customer_service', 'contador', 'tesorero', 'auxiliar_contable',
    'ejecutivo_cobranza', 'ejecutivo_pricing', 'gerente_operaciones',
    'gerente_visor', 'coordinador_logistico', 'cliente', 'agente_carga'
  ]::public.app_role[] LOOP
    v_user := gen_random_uuid();
    PERFORM pg_temp.seed_auth_user(v_user);
    INSERT INTO public.organization_members(organization_id, user_id, role)
      VALUES (fx.org_a, v_user, 'customer_service');
    -- Proteger este registro de la sincronización que retira el rol previo.
    INSERT INTO public.user_roles(user_id, role) VALUES (v_user, 'cliente')
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
    UPDATE public.organization_members SET role = v_role
      WHERE organization_id = fx.org_a AND user_id = v_user;
    UPDATE public.user_roles SET role = v_role WHERE user_id = v_user;

    PERFORM pg_temp.as_user(v_user);
    PERFORM pg_temp.assert(public.org_scope() IS NOT DISTINCT FROM fx.org_a,
      format('rol %s: el fixture debe tener scope A', v_role));
    v_esperados := CASE WHEN v_role IN ('cliente', 'agente_carga')
      THEN '{}'::uuid[] ELSE v_a END;
    PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_esperados,
      format('rol %s: sólo filas visibles A, sin B ni borrados', v_role));
    PERFORM pg_temp.as_postgres();
    v_matriz := v_matriz + 1;
  END LOOP;
  PERFORM pg_temp.assert(v_matriz = 17, 'deben ejecutarse los 17 roles no-plataforma');

  -- El permiso viewer incluye vendedor: NO estrechar a own + bolsa.
  PERFORM pg_temp.as_user(v_vendedor);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_a,
    'vendedor conserva propio, bolsa y lead asignado a otro vendedor');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_b,
    'admin B recibe B y nunca A aunque coinciden todas las claves');
  PERFORM pg_temp.as_postgres();

  -- El rol global obsoleto no puede sustituir la membresía de esta org.
  PERFORM pg_temp.as_user(v_global_obsoleto);
  PERFORM pg_temp.assert(public.has_role(auth.uid(), 'admin')
    AND NOT public.has_any_role_in_org(auth.uid(), ARRAY['viewer', 'operador']::public.app_role[], fx.org_a),
    'fixture: admin_org global y cliente en organization_members');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'rol global admin_org no eleva membresía cliente');
  PERFORM pg_temp.as_postgres();
  UPDATE public.organization_members SET role = 'customer_service'
    WHERE organization_id = fx.org_a AND user_id = v_global_obsoleto;
  UPDATE public.user_roles SET role = 'cliente' WHERE user_id = v_global_obsoleto;
  PERFORM pg_temp.as_user(v_global_obsoleto);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_a,
    'membresía lectora sigue válida con rol global cliente obsoleto');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(v_sin_espejo);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_a,
    'membresía lectora sigue válida sin espejo en user_roles');
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.as_user(v_sin_membresia);
  PERFORM pg_temp.assert(public.org_scope() IS NULL,
    'sin membership no debe haber org_scope');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'gerente global sin membership no recibe leads');
  PERFORM pg_temp.as_postgres();

  -- auth.uid nulo debe fallar cerrado incluso con EXECUTE de authenticated.
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.as_authenticated_sin_uid();
  PERFORM pg_temp.assert(auth.uid() IS NULL, 'fixture sin sub debe tener auth.uid NULL');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'JWT authenticated sin sub no recibe leads');
  -- Claim real service_role sin sub, pero oráculo bajo rol authenticated.
  PERFORM pg_temp.as_service_role();
  PERFORM pg_temp.assert(auth.uid() IS NULL AND auth.role() = 'service_role',
    'fixture service_role sin sub debe mantener auth.uid NULL');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'service_role sin UID no recibe leads aunque tiene EXECUTE', true);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_a,
    'service_role con UID admin A respeta la misma visibilidad de usuario', true);
  PERFORM pg_temp.as_postgres();

  -- Super admin de plataforma sin membership: el helper permite operar sólo
  -- dentro de su tenant activo. Ausente y después de limpiar, devuelve vacío.
  PERFORM pg_temp.as_user(v_sa);
  PERFORM pg_temp.assert(public.org_scope() IS NULL, 'super admin empieza sin tenant');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'super admin sin tenant activo');
  PERFORM public.set_super_admin_org(fx.org_a);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_a, 'super admin tenant A');
  PERFORM public.set_super_admin_org(fx.org_b);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, v_b, 'super admin cambia a B');
  PERFORM public.set_super_admin_org(NULL);
  PERFORM pg_temp.assert_duplicados_visibles(v_keys, '{}'::uuid[],
    'super admin limpia tenant y no conserva resultados anteriores');
  PERFORM pg_temp.as_postgres();

  -- Congelar normalización, mínimos, comparación telefónica por 10 dígitos,
  -- campos de salida, soft delete y DISTINCT de claves repetidas.
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.assert_duplicados_visibles(
    jsonb_build_array(jsonb_build_object('empresa', upper('RLS-Duplicados:' || v_token))),
    v_a, 'empresa ignora puntuación y mayúsculas');
  PERFORM pg_temp.assert_duplicados_visibles(
    jsonb_build_array(jsonb_build_object('email', ' PROPIO+' || v_token || '@example.INVALID ')),
    ARRAY[a_propio], 'email ignora mayúsculas y espacios exteriores');
  PERFORM pg_temp.assert_duplicados_visibles(
    '[{"telefono":"+1 (55) 1200-3401"}]'::jsonb,
    ARRAY[a_propio], 'teléfono ignora formato y prefijo fuera de últimos 10 dígitos');
  PERFORM pg_temp.assert_duplicados_visibles(
    jsonb_build_array(jsonb_build_object('email', 'borrado+' || v_token || '@example.invalid')),
    '{}'::uuid[], 'lead eliminado no aparece aunque email coincide exactamente');
  PERFORM pg_temp.assert_duplicados_visibles(v_keys || v_keys, v_a,
    'DISTINCT conserva una sola fila por lead aunque coincidan múltiples claves');
  PERFORM pg_temp.assert_duplicados_visibles(
    '[{"empresa":"ABC","telefono":"1234567"}]'::jsonb,
    '{}'::uuid[], 'empresa de 3 y teléfono de 7 no alcanzan mínimos');
  PERFORM pg_temp.assert_duplicados_visibles(
    '[{"empresa":"ab12"}]'::jsonb, ARRAY[a_umbral], 'empresa de 4 sí alcanza mínimo');
  PERFORM pg_temp.assert_duplicados_visibles(
    '[{"telefono":"12345678"}]'::jsonb, ARRAY[a_umbral], 'teléfono de 8 sí alcanza mínimo');
  PERFORM pg_temp.assert_duplicados_visibles(
    '[{}, {"empresa":"---","email":"   ","telefono":"()"}]'::jsonb,
    '{}'::uuid[], 'claves vacías no coinciden con columnas vacías');
  PERFORM pg_temp.assert_duplicados_visibles('[]'::jsonb, '{}'::uuid[], 'lote vacío');
  PERFORM pg_temp.assert_duplicados_visibles(NULL::jsonb, '{}'::uuid[], 'lote SQL NULL');
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'OK — duplicados CRM: 17 roles, paridad completa con SELECT/RLS, dos tenants, estados de sesión y normalización';
END;
$$;

ROLLBACK;
