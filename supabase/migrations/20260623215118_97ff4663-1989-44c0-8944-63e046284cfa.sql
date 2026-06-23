DO $$
DECLARE
  v_user_id uuid;
  v_proveedor_id uuid;
  v_agente_id uuid;
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'agente.demo@librecarga.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario de prueba no existe';
  END IF;

  -- Proveedor AGENTEPRUEBA (idempotente)
  SELECT id INTO v_proveedor_id
    FROM public.proveedores
   WHERE nombre = 'AGENTEPRUEBA' AND organization_id = v_org_id;

  IF v_proveedor_id IS NULL THEN
    INSERT INTO public.proveedores (nombre, tipo, pais, organization_id, origen_proveedor)
    VALUES ('AGENTEPRUEBA', 'Agente de Carga', 'CN', v_org_id, 'Extranjero')
    RETURNING id INTO v_proveedor_id;
  END IF;

  -- Agente de costeo AGENTEPRUEBA (idempotente)
  SELECT id INTO v_agente_id
    FROM public.costeo_agentes
   WHERE nombre = 'AGENTEPRUEBA' AND organization_id = v_org_id;

  IF v_agente_id IS NULL THEN
    INSERT INTO public.costeo_agentes (organization_id, proveedor_id, nombre, pais, dias_credito, activo)
    VALUES (v_org_id, v_proveedor_id, 'AGENTEPRUEBA', 'CN', 0, true)
    RETURNING id INTO v_agente_id;
  END IF;

  -- Re-vincular el usuario al nuevo agente (borra vínculo anterior a LONGSAIL)
  DELETE FROM public.agente_users WHERE user_id = v_user_id;
  INSERT INTO public.agente_users (user_id, agente_id, organization_id)
  VALUES (v_user_id, v_agente_id, v_org_id);
END $$;