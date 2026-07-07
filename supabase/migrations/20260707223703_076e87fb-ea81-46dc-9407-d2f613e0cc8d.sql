CREATE OR REPLACE FUNCTION public.eliminar_factura_borrador(p_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura       public.facturas;
  v_caller_org    uuid;
  v_proforma_ids  uuid[] := ARRAY[]::uuid[];
  v_bitacora_ids  uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_factura_id IS NULL THEN
    RAISE EXCEPTION 'factura_id es obligatorio';
  END IF;

  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_factura.estado <> 'Borrador'::estado_factura THEN
    RAISE EXCEPTION 'Sólo se pueden eliminar facturas en estado Borrador (estado actual: %)', v_factura.estado;
  END IF;
  IF v_factura.facturapi_id IS NOT NULL OR v_factura.uuid_fiscal IS NOT NULL THEN
    RAISE EXCEPTION 'La factura ya fue timbrada y no puede eliminarse';
  END IF;

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para eliminar borradores de factura';
  END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_factura.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes eliminar borradores de otra organización';
  END IF;
  PERFORM public._assert_writer(v_factura.organization_id);

  -- Fuente 1: link directo (proformas.factura_id) — reservada a futuro.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_proforma_ids
  FROM public.proformas
  WHERE factura_id = p_factura_id;

  -- Fuente 2: link inverso (facturas.proforma_id) — caso 1:1 real hoy.
  IF v_factura.proforma_id IS NOT NULL THEN
    v_proforma_ids := array(SELECT DISTINCT unnest(v_proforma_ids || ARRAY[v_factura.proforma_id]));
  END IF;

  -- Fuente 3: bitácora `factura.borrador_generado` — caso consolidado (proforma_id NULL en la factura).
  SELECT COALESCE(
    array_agg(DISTINCT pid),
    ARRAY[]::uuid[]
  )
    INTO v_bitacora_ids
  FROM public.bitacora_actividad ba,
       LATERAL jsonb_array_elements_text(COALESCE(ba.detalles -> 'proforma_ids', '[]'::jsonb)) AS pid
  WHERE ba.modulo = 'facturacion'
    AND ba.accion = 'factura.borrador_generado'
    AND ba.entidad_id = p_factura_id;

  IF array_length(v_bitacora_ids, 1) IS NOT NULL THEN
    v_proforma_ids := array(SELECT DISTINCT unnest(v_proforma_ids || v_bitacora_ids));
  END IF;

  -- Revertir proformas (si hay algo que revertir).
  IF array_length(v_proforma_ids, 1) IS NOT NULL THEN
    UPDATE public.proformas
       SET factura_id        = NULL,
           estado_proforma   = 'pendiente',
           fecha_facturacion = NULL,
           updated_at        = now()
     WHERE id = ANY(v_proforma_ids);
  END IF;

  -- Borrar conceptos y la factura.
  DELETE FROM public.conceptos_factura WHERE factura_id = p_factura_id;
  DELETE FROM public.facturas WHERE id = p_factura_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  )
  VALUES (
    v_factura.organization_id, auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'factura.borrador_eliminado', 'facturacion', p_factura_id, v_factura.numero,
    jsonb_build_object(
      'proformas_revertidas', v_proforma_ids,
      'origen', v_factura.origen
    )
  );
END $function$;