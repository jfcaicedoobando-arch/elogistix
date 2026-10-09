-- Canonical mirror; apply the registered forward migration, not this file.
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
