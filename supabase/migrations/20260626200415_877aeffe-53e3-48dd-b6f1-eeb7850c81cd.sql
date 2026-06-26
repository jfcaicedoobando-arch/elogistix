
-- v13.137.18 — Self-service FacturApi API keys (cifradas en vault)

ALTER TABLE public.facturapi_credenciales
  ADD COLUMN IF NOT EXISTS api_key_sandbox_vault_id uuid NULL,
  ADD COLUMN IF NOT EXISTS api_key_live_vault_id uuid NULL,
  ADD COLUMN IF NOT EXISTS api_key_sandbox_last4 text NULL,
  ADD COLUMN IF NOT EXISTS api_key_live_last4 text NULL;

-- Helper interno: valida que el caller sea admin_org/super_admin de la org.
CREATE OR REPLACE FUNCTION public._assert_facturapi_admin(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_auth' USING ERRCODE = '28000';
  END IF;

  IF public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.organization_members om
     WHERE om.user_id = v_uid
       AND om.organization_id = p_org_id
       AND om.role IN ('admin_org','admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_facturapi_admin(uuid) FROM public, anon, authenticated;

-- set_facturapi_api_key: guarda la key en vault y persiste vault_id + last4.
CREATE OR REPLACE FUNCTION public.set_facturapi_api_key(
  p_org_id uuid,
  p_ambiente text,
  p_api_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_key text := btrim(coalesce(p_api_key, ''));
  v_prefix_ok boolean;
  v_new_id uuid;
  v_old_id uuid;
  v_last4 text;
  v_name text;
BEGIN
  PERFORM public._assert_facturapi_admin(p_org_id);

  IF p_ambiente NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'ambiente_invalido' USING ERRCODE = '22023';
  END IF;

  IF length(v_key) < 16 THEN
    RAISE EXCEPTION 'api_key_invalida' USING ERRCODE = '22023';
  END IF;

  v_prefix_ok := (p_ambiente = 'sandbox' AND v_key LIKE 'sk_test_%')
              OR (p_ambiente = 'live'    AND v_key LIKE 'sk_live_%');
  IF NOT v_prefix_ok THEN
    RAISE EXCEPTION 'api_key_prefix_no_coincide_con_ambiente' USING ERRCODE = '22023';
  END IF;

  -- Asegura fila base
  INSERT INTO public.facturapi_credenciales (organization_id, ambiente)
  VALUES (p_org_id, p_ambiente)
  ON CONFLICT (organization_id) DO NOTHING;

  v_last4 := right(v_key, 4);
  v_name  := 'facturapi:' || p_org_id::text || ':' || p_ambiente || ':' || gen_random_uuid()::text;

  v_new_id := vault.create_secret(v_key, v_name, 'FacturApi API key (' || p_ambiente || ') para org ' || p_org_id::text);

  IF p_ambiente = 'sandbox' THEN
    SELECT api_key_sandbox_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_sandbox_vault_id = v_new_id,
           api_key_sandbox_last4    = v_last4,
           updated_at               = now()
     WHERE organization_id = p_org_id;
  ELSE
    SELECT api_key_live_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_live_vault_id = v_new_id,
           api_key_live_last4    = v_last4,
           updated_at            = now()
     WHERE organization_id = p_org_id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_id;
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, user_id, accion, entidad_tipo, entidad_id, metadata)
  VALUES (p_org_id, auth.uid(), 'facturapi_api_key_actualizada', 'facturapi_credenciales', p_org_id,
          jsonb_build_object('ambiente', p_ambiente, 'last4', v_last4));
END;
$$;

REVOKE ALL ON FUNCTION public.set_facturapi_api_key(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_facturapi_api_key(uuid, text, text) TO authenticated, service_role;

-- clear_facturapi_api_key
CREATE OR REPLACE FUNCTION public.clear_facturapi_api_key(
  p_org_id uuid,
  p_ambiente text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_old_id uuid;
BEGIN
  PERFORM public._assert_facturapi_admin(p_org_id);

  IF p_ambiente NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'ambiente_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ambiente = 'sandbox' THEN
    SELECT api_key_sandbox_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_sandbox_vault_id = NULL,
           api_key_sandbox_last4    = NULL,
           updated_at               = now()
     WHERE organization_id = p_org_id;
  ELSE
    SELECT api_key_live_vault_id INTO v_old_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
    UPDATE public.facturapi_credenciales
       SET api_key_live_vault_id = NULL,
           api_key_live_last4    = NULL,
           updated_at            = now()
     WHERE organization_id = p_org_id;
  END IF;

  IF v_old_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_old_id;
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, user_id, accion, entidad_tipo, entidad_id, metadata)
  VALUES (p_org_id, auth.uid(), 'facturapi_api_key_borrada', 'facturapi_credenciales', p_org_id,
          jsonb_build_object('ambiente', p_ambiente));
END;
$$;

REVOKE ALL ON FUNCTION public.clear_facturapi_api_key(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_facturapi_api_key(uuid, text) TO authenticated, service_role;

-- get_facturapi_api_key_internal: SÓLO service_role. Devuelve la key en claro.
CREATE OR REPLACE FUNCTION public.get_facturapi_api_key_internal(
  p_org_id uuid,
  p_ambiente text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_vault_id uuid;
  v_secret text;
BEGIN
  IF p_ambiente NOT IN ('sandbox','live') THEN
    RAISE EXCEPTION 'ambiente_invalido' USING ERRCODE = '22023';
  END IF;

  IF p_ambiente = 'sandbox' THEN
    SELECT api_key_sandbox_vault_id INTO v_vault_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
  ELSE
    SELECT api_key_live_vault_id INTO v_vault_id FROM public.facturapi_credenciales WHERE organization_id = p_org_id;
  END IF;

  IF v_vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = v_vault_id;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_facturapi_api_key_internal(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_facturapi_api_key_internal(uuid, text) TO service_role;
