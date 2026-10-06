CREATE OR REPLACE FUNCTION public.crm_crear_oportunidad_con_empresa(p_empresa_id uuid, p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_datos public.crm_oportunidades%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'Selecciona una organización e inicia sesión' USING ERRCODE = '42501';
  END IF;
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona la empresa asociada' USING ERRCODE = '22023';
  END IF;
  IF p_datos IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Los datos de la oportunidad no son válidos' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.crm_empresas
    WHERE id = p_empresa_id AND organization_id = v_org AND deleted_at IS NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La empresa no está disponible en esta organización' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_datos FROM jsonb_populate_record(NULL::public.crm_oportunidades, p_datos);
  IF nullif(btrim(v_datos.nombre), '') IS NULL THEN
    RAISE EXCEPTION 'Nombre es obligatorio' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.crm_oportunidades (
    organization_id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email,
    etapa_id, monto_estimado, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real,
    valor_real, modo, tipo_carga, origen, destino, notas, created_by,
    monto_meta, fecha_meta_cierre, compromiso_nota, margen_pct, riesgos_objeciones,
    puerto_origen_id, puerto_destino_id
  ) VALUES (
    v_org, v_datos.nombre, v_datos.cliente_id, coalesce(v_datos.cliente_nombre, ''), v_datos.lead_id,
    coalesce(v_datos.vendedor_id, auth.uid()), coalesce(v_datos.vendedor_email, ''),
    v_datos.etapa_id, coalesce(v_datos.monto_estimado, 0), coalesce(v_datos.moneda, 'MXN'),
    coalesce(v_datos.probabilidad, 0), v_datos.fecha_estimada_cierre, v_datos.fecha_cierre_real,
    v_datos.valor_real, coalesce(v_datos.modo, ''), coalesce(v_datos.tipo_carga, ''),
    coalesce(v_datos.origen, ''), coalesce(v_datos.destino, ''), coalesce(v_datos.notas, ''), auth.uid(),
    v_datos.monto_meta, v_datos.fecha_meta_cierre, v_datos.compromiso_nota, v_datos.margen_pct,
    coalesce(v_datos.riesgos_objeciones, ''), v_datos.puerto_origen_id, v_datos.puerto_destino_id
  ) RETURNING id INTO v_id;
  INSERT INTO public.crm_oportunidad_empresa (organization_id, oportunidad_id, empresa_id)
    VALUES (v_org, v_id, p_empresa_id);
  RETURN jsonb_build_object('id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.crm_crear_oportunidad_con_empresa(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_crear_oportunidad_con_empresa(uuid, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.crm_crear_oportunidad_con_empresa(uuid, jsonb) IS 'Alta manual atómica de oportunidad y empresa activa de la misma organización; SECURITY INVOKER conserva las políticas RLS y los guards existentes. No modifica oportunidades históricas.';