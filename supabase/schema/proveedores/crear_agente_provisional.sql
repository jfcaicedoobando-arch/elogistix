CREATE OR REPLACE FUNCTION public.crear_agente_provisional(p_nombre text, p_pais text DEFAULT 'CN', p_contacto text DEFAULT NULL, p_email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.current_user_org_id(); v_nombre text := btrim(coalesce(p_nombre,'')); v_prov uuid; v_ag uuid;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sin organización activa' USING ERRCODE='42501'; END IF;
  IF NOT (public._crm_es_pricing(v_org) OR public.has_any_role_in_org(auth.uid(), ARRAY['admin']::app_role[], v_org)) THEN
    RAISE EXCEPTION 'No tienes permiso para dar de alta agentes' USING ERRCODE='42501'; END IF;
  IF length(v_nombre) < 2 THEN RAISE EXCEPTION 'El nombre del agente es obligatorio' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_org::text || lower(v_nombre)));
  SELECT a.id INTO v_ag FROM costeo_agentes a WHERE a.organization_id = v_org AND lower(btrim(a.nombre)) = lower(v_nombre) LIMIT 1;
  IF v_ag IS NOT NULL THEN RETURN v_ag; END IF;
  SELECT id INTO v_prov FROM proveedores WHERE organization_id = v_org AND deleted_at IS NULL AND tipo = 'Agente de Carga' AND lower(btrim(nombre)) = lower(v_nombre) LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO proveedores (nombre, tipo, pais, contacto, email, organization_id, origen_proveedor, estado_alta)
    VALUES (v_nombre, 'Agente de Carga', coalesce(nullif(btrim(p_pais),''),'CN'), coalesce(p_contacto,''), coalesce(p_email,''), v_org, 'Extranjero', 'provisional')
    RETURNING id INTO v_prov;
  END IF;
  INSERT INTO costeo_agentes (organization_id, proveedor_id, nombre, pais, contacto_tarifario, email, notas)
  VALUES (v_org, v_prov, v_nombre, coalesce(nullif(btrim(p_pais),''),'CN'), p_contacto, p_email, 'Alta provisional desde tarifa')
  RETURNING id INTO v_ag;
  RETURN v_ag;
END $$;
REVOKE ALL ON FUNCTION public.crear_agente_provisional(text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crear_agente_provisional(text,text,text,text) TO authenticated;
