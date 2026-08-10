-- Ola 3 · RG2: no reutilizar/fusionar clientes por RFC genérico del SAT.
CREATE OR REPLACE FUNCTION public.convertir_prospecto_a_cliente_rpc(p_cotizacion_id uuid, p_cliente jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_prospecto boolean;
  v_cliente_id uuid;
  v_nombre text;
  v_rfc text;
  v_creado boolean := false;
BEGIN
  SELECT organization_id, es_prospecto, cliente_id
    INTO v_org, v_es_prospecto, v_cliente_id
  FROM public.cotizaciones WHERE id = p_cotizacion_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Idempotencia: si ya se convirtió, devolver el cliente existente.
  IF v_cliente_id IS NOT NULL AND COALESCE(v_es_prospecto, false) = false THEN
    SELECT nombre INTO v_nombre FROM public.clientes WHERE id = v_cliente_id;
    RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', false);
  END IF;

  v_nombre := NULLIF(btrim(COALESCE(p_cliente->>'nombre', '')), '');
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_SIN_NOMBRE';
  END IF;
  v_rfc := NULLIF(btrim(upper(COALESCE(p_cliente->>'rfc', ''))), '');

  -- Reutiliza cliente existente con el mismo RFC dentro de la organización.
  -- RG2: los RFC genéricos del SAT (XAXX010101000 público en general,
  -- XEXX010101000 extranjeros) no identifican a nadie: nunca matchean.
  IF v_rfc IS NOT NULL AND v_rfc NOT IN ('XAXX010101000', 'XEXX010101000') THEN
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE organization_id = v_org AND upper(btrim(rfc)) = v_rfc AND deleted_at IS NULL
      AND upper(btrim(rfc)) NOT IN ('XAXX010101000', 'XEXX010101000')
    LIMIT 1;
  ELSE
    v_cliente_id := NULL;
  END IF;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      organization_id, nombre, contacto, email, telefono, rfc, direccion, ciudad, estado, cp
    ) VALUES (
      v_org,
      v_nombre,
      COALESCE(p_cliente->>'contacto', ''),
      COALESCE(p_cliente->>'email', ''),
      COALESCE(p_cliente->>'telefono', ''),
      COALESCE(v_rfc, ''),
      COALESCE(p_cliente->>'direccion', ''),
      COALESCE(p_cliente->>'ciudad', ''),
      COALESCE(p_cliente->>'estado', ''),
      COALESCE(p_cliente->>'cp', '')
    )
    RETURNING id INTO v_cliente_id;
    v_creado := true;
  END IF;

  UPDATE public.cotizaciones
     SET cliente_id = v_cliente_id,
         cliente_nombre = v_nombre,
         es_prospecto = false,
         updated_at = now()
   WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object('cliente_id', v_cliente_id, 'nombre', v_nombre, 'creado', v_creado);
END;
$function$;

-- Ola 3 · RG3b: super_admin es rol de plataforma (vive en user_roles) y no
-- debe quedar bloqueado por el rol de una membresía de organización.
CREATE OR REPLACE FUNCTION public.has_any_role_efectivo(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
     OR (
       public.has_any_role(_user_id, _roles)
       AND (
         NOT EXISTS (
           SELECT 1 FROM public.organization_members om
            WHERE om.user_id = _user_id
              AND om.organization_id = public.current_user_org_id()
         )
         OR EXISTS (
           SELECT 1 FROM public.organization_members om
            WHERE om.user_id = _user_id
              AND om.organization_id = public.current_user_org_id()
              AND om.role = ANY (
                SELECT DISTINCT e
                FROM unnest(_roles) AS r, unnest(public.roles_jerarquia(r)) AS e
              )
         )
       )
     );
$$;

REVOKE ALL ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role_efectivo(uuid, app_role[]) TO service_role;

-- Ola 3 · P1: ajustes de factura de proveedor en UNA transacción.
CREATE OR REPLACE FUNCTION public.crear_ajustes_factura_proveedor_rpc(
  p_factura_id uuid,
  p_ajustes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fact public.proveedor_facturas%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_fact
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROVEEDOR_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_fact.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- Idempotencia: soft-delete de ajustes previos de esta factura.
  UPDATE public.conceptos_costo cc
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE cc.deleted_at IS NULL
     AND cc.origen = 'ajuste_factura_proveedor'
     AND cc.id IN (
       SELECT pfc.concepto_costo_id
       FROM public.proveedor_facturas_conceptos pfc
       WHERE pfc.proveedor_factura_id = p_factura_id
         AND pfc.concepto_costo_id IS NOT NULL
     );

  -- Conceptos de ajuste + puentes, atómicos. Los datos de la factura salen de
  -- la fila bloqueada: el cliente sólo envía [{embarque_id, descripcion, monto}].
  WITH nuevos AS (
    INSERT INTO public.conceptos_costo (
      embarque_id, organization_id, proveedor_id, proveedor_nombre,
      concepto, monto, moneda, origen,
      estado_liquidacion, fecha_pago, referencia_pago
    )
    SELECT
      (a->>'embarque_id')::uuid,
      v_fact.organization_id,
      v_fact.proveedor_id,
      v_fact.proveedor_nombre,
      'Ajuste factura ' || COALESCE(v_fact.folio_proveedor, '') || ': ' || COALESCE(a->>'descripcion', ''),
      (a->>'monto')::numeric,
      v_fact.moneda,
      'ajuste_factura_proveedor',
      'Pagado'::estado_liquidacion,
      v_fact.fecha_emision,
      v_fact.folio_proveedor
    FROM jsonb_array_elements(COALESCE(p_ajustes, '[]'::jsonb)) AS a
    WHERE NULLIF(btrim(COALESCE(a->>'embarque_id', '')), '') IS NOT NULL
      AND abs(COALESCE((a->>'monto')::numeric, 0)) > 0.01
    RETURNING id, concepto, monto
  ),
  puentes AS (
    INSERT INTO public.proveedor_facturas_conceptos (
      proveedor_factura_id, organization_id, concepto_costo_id,
      descripcion, cantidad, monto
    )
    SELECT p_factura_id, v_fact.organization_id, n.id, n.concepto, 1, n.monto
    FROM nuevos n
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM puentes;

  RETURN jsonb_build_object('ajustes_creados', v_count, 'folio', v_fact.folio_proveedor);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_ajustes_factura_proveedor_rpc(uuid, jsonb) TO service_role;