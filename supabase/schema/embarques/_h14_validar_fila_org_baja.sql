-- Preserve the existing staff, client and freight-agent shipment read scopes.
-- This is admission/visibility, never a replacement for a table write policy.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_embarque_visible_actor_baja(p_org uuid, p_embarque uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_uid uuid := auth.uid();
BEGIN
  IF v_role IN ('postgres', 'service_role') THEN RETURN true; END IF;
  IF public.has_role(v_uid, 'super_admin'::public.app_role) IS TRUE THEN RETURN true; END IF;
  IF p_org = public.current_user_org_id() AND public.has_role(v_uid, 'viewer'::public.app_role) IS TRUE THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.embarques e
    WHERE e.id = p_embarque AND e.organization_id = p_org AND e.deleted_at IS NULL
      AND ((public.has_role(v_uid, 'cliente'::public.app_role) IS TRUE
        AND e.cliente_id IN (SELECT public.current_user_client_ids()))
      OR (public.has_role(v_uid, 'agente_carga'::public.app_role) IS TRUE
        AND p_org = public.current_agente_org()
        AND public.current_agente_id() IS NOT NULL AND e.agente_id = public.current_agente_id()))
  );
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_embarque_visible_actor_baja(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Validate candidate references before acquiring any org/parent lock. Missing
-- and cross-tenant references intentionally have the same non-disclosing error.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_validar_fila_org_baja(p_org uuid, p_tabla text, p_fila jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_col text;
  v_parent text;
  v_id uuid;
  v_ids uuid[];
  v_ok boolean;
  v_parent_row jsonb;
  v_target uuid;
  v_role text := COALESCE(NULLIF(current_setting('role', true), 'none'), SESSION_USER::text);
  v_restringido boolean;
BEGIN
  PERFORM public._h14_validar_actor_org_baja(p_org);
  IF p_fila IS NULL THEN RETURN; END IF;
  IF (p_fila->>'organization_id')::uuid IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  v_restringido := v_role NOT IN ('postgres', 'service_role')
    AND public.has_role(auth.uid(), 'super_admin'::public.app_role) IS NOT TRUE
    AND public.has_role(auth.uid(), 'viewer'::public.app_role) IS NOT TRUE;
  IF v_restringido AND p_tabla IN ('facturas', 'proformas') AND (
    public.has_role(auth.uid(), 'cliente'::public.app_role) IS NOT TRUE
    OR (p_fila->>'cliente_id')::uuid IS NULL
    OR (p_fila->>'cliente_id')::uuid NOT IN (SELECT public.current_user_client_ids())
    OR p_fila->>'deleted_at' IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  FOR v_col, v_parent IN
    SELECT c, t FROM (VALUES
      ('embarque_id', 'embarques'),
      ('factura_id', 'facturas'),
      ('factura_secundaria_id', 'facturas'),
      ('proveedor_factura_id', 'proveedor_facturas'),
      ('proforma_id', 'proformas'),
      ('proforma_id_origen', 'proformas'),
      ('consolidada_en', 'proformas'),
      ('concepto_costo_id', 'conceptos_costo'),
      ('pago_factura_id', 'pagos_factura'),
      ('embarque_contenedor_id', 'embarque_contenedores')
    ) AS refs(c, t)
  LOOP
    v_id := NULLIF(p_fila->>v_col, '')::uuid;
    IF v_id IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1 AND organization_id = $2)', v_parent)
      INTO v_ok USING v_id, p_org;
    IF v_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
    END IF;
    IF v_restringido THEN
      IF v_parent = 'embarques' THEN
        v_ok := public._h14_embarque_visible_actor_baja(p_org, v_id);
      ELSE
        EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE id = $1 AND organization_id = $2', v_parent)
          INTO v_parent_row USING v_id, p_org;
        v_ok := false;
        IF v_parent IN ('facturas', 'proformas') THEN
          v_ok := public.has_role(auth.uid(), 'cliente'::public.app_role) IS TRUE
            AND (v_parent_row->>'cliente_id')::uuid IN (SELECT public.current_user_client_ids())
            AND v_parent_row->>'deleted_at' IS NULL;
        END IF;
        FOR v_target IN SELECT unnest(public._h14_grafo_fila_baja(p_org, v_parent, v_parent_row)) LOOP
          IF public._h14_embarque_visible_actor_baja(p_org, v_target) IS NOT TRUE THEN v_ok := false; EXIT; END IF;
        END LOOP;
        -- Other parent tables have no canonical external SELECT policy. A
        -- visible shipment alone must not make their hidden documents visible.
      END IF;
      IF v_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
  FOR v_col, v_parent IN
    SELECT c, t FROM (VALUES ('embarques_ids', 'embarques'), ('proformas_origen', 'proformas')) AS refs(c, t)
  LOOP
    SELECT COALESCE(array_agg(x::uuid), ARRAY[]::uuid[]) INTO v_ids
    FROM jsonb_array_elements_text(COALESCE(NULLIF(p_fila->v_col, 'null'::jsonb), '[]'::jsonb)) AS a(x)
    WHERE x IS NOT NULL;
    IF cardinality(v_ids) = 0 THEN CONTINUE; END IF;
    EXECUTE format('SELECT NOT EXISTS (SELECT 1 FROM unnest($1::uuid[]) AS u(id) WHERE NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id = u.id AND p.organization_id = $2))', v_parent)
      INTO v_ok USING v_ids, p_org;
    IF v_ok IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
    END IF;
    IF v_restringido THEN
      FOR v_id IN SELECT unnest(v_ids) LOOP
        IF v_parent = 'embarques' THEN
          v_ok := public._h14_embarque_visible_actor_baja(p_org, v_id);
        ELSE
          SELECT to_jsonb(p) INTO v_parent_row FROM public.proformas p WHERE p.id = v_id AND p.organization_id = p_org;
          v_ok := public.has_role(auth.uid(), 'cliente'::public.app_role) IS TRUE
            AND (v_parent_row->>'cliente_id')::uuid IN (SELECT public.current_user_client_ids())
            AND v_parent_row->>'deleted_at' IS NULL;
          FOR v_target IN SELECT unnest(public._h14_grafo_fila_baja(p_org, v_parent, v_parent_row)) LOOP
            IF public._h14_embarque_visible_actor_baja(p_org, v_target) IS NOT TRUE THEN v_ok := false; EXIT; END IF;
          END LOOP;
        END IF;
        IF v_ok IS NOT TRUE THEN
          RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_validar_fila_org_baja(uuid, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
