-- Fuente canónica de public.crear_clientes(jsonb) (Ola 9 · M4).
-- Alta canónica de clientes: valida rol, organización y completitud fiscal
-- cuando el cliente lleva RFC. El INSERT directo a public.clientes está
-- revocado para authenticated.

CREATE OR REPLACE FUNCTION public.crear_clientes(p_clientes jsonb)
RETURNS SETOF public.clientes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_row jsonb;
  v_rfc text;
  v_nombre text;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  IF p_clientes IS NULL OR jsonb_typeof(p_clientes) <> 'array'
     OR jsonb_array_length(p_clientes) = 0 THEN
    RAISE EXCEPTION 'LC_CLIENTE_PAYLOAD_INVALIDO: se esperaba un arreglo de clientes'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_clientes) > 1000 THEN
    RAISE EXCEPTION 'LC_CLIENTE_LOTE_EXCEDIDO: máximo 1000 clientes por llamada'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.has_any_role(v_uid, ARRAY['admin'::public.app_role, 'admin_org'::public.app_role,
                                     'operador'::public.app_role, 'contador'::public.app_role,
                                     'super_admin'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_PERMISO: tu rol no puede dar de alta clientes'
      USING ERRCODE = '42501';
  END IF;

  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_ORG: no hay organización activa'
      USING ERRCODE = '22023';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_clientes) LOOP
    v_nombre := btrim(COALESCE(v_row->>'nombre', ''));
    IF v_nombre = '' THEN
      RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE: la razón social es obligatoria'
        USING ERRCODE = '22023';
    END IF;

    v_rfc := upper(btrim(COALESCE(v_row->>'rfc', '')));

    -- Cliente facturable = trae RFC propio. Entonces el CFDI necesita datos
    -- fiscales completos desde el alta, no al momento de timbrar.
    IF v_rfc <> '' AND v_rfc NOT IN ('XEXX010101000', 'XAXX010101000') THEN
      IF btrim(COALESCE(v_row->>'regimen_fiscal', '')) = ''
         OR btrim(COALESCE(v_row->>'uso_cfdi_default', '')) = ''
         OR btrim(COALESCE(v_row->>'cp', '')) = ''
         OR btrim(COALESCE(v_row->>'direccion', '')) = '' THEN
        RAISE EXCEPTION 'LC_CLIENTE_FISCAL_INCOMPLETO: % lleva RFC, así que necesita régimen fiscal, uso de CFDI, código postal y dirección', v_nombre
          USING ERRCODE = '22023';
      END IF;
    END IF;

    INSERT INTO public.clientes (
      organization_id, nombre, rfc, direccion, ciudad, estado, cp, contacto,
      telefono, email, regimen_fiscal, uso_cfdi_default, dias_credito,
      limite_credito_mxn, sin_comision,
      requiere_autorizacion_cotizacion, requiere_autorizacion_proforma
    ) VALUES (
      v_org,
      v_nombre,
      NULLIF(v_rfc, ''),
      NULLIF(btrim(COALESCE(v_row->>'direccion', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'ciudad', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'estado', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'cp', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'contacto', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'telefono', '')), ''),
      NULLIF(lower(btrim(COALESCE(v_row->>'email', ''))), ''),
      NULLIF(btrim(COALESCE(v_row->>'regimen_fiscal', '')), ''),
      NULLIF(btrim(COALESCE(v_row->>'uso_cfdi_default', '')), ''),
      COALESCE((v_row->>'dias_credito')::int, 0),
      NULLIF(v_row->>'limite_credito_mxn', '')::numeric,
      COALESCE((v_row->>'sin_comision')::boolean, false),
      COALESCE((v_row->>'requiere_autorizacion_cotizacion')::boolean, false),
      COALESCE((v_row->>'requiere_autorizacion_proforma')::boolean, false)
    ) RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_org, v_uid, (SELECT email FROM auth.users WHERE id = v_uid),
    'cliente.alta', 'clientes', v_ids[1],
    (SELECT nombre FROM public.clientes WHERE id = v_ids[1]),
    jsonb_build_object('cantidad', array_length(v_ids, 1))
  );

  RETURN QUERY SELECT * FROM public.clientes WHERE id = ANY(v_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_clientes(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_clientes(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_clientes(jsonb) TO authenticated, service_role;
REVOKE INSERT ON TABLE public.clientes FROM authenticated;
