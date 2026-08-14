-- Clientes "de casa": banderas de autorización del cliente
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS requiere_autorizacion_cotizacion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requiere_autorizacion_proforma boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.clientes.requiere_autorizacion_cotizacion IS
  'Si false, el cliente es "de casa": sus cotizaciones pueden aprobarse internamente sin autorización del cliente.';
COMMENT ON COLUMN public.clientes.requiere_autorizacion_proforma IS
  'Si false, el cliente es "de casa": sus proformas se aceptan automáticamente al aprobarse internamente.';

-- Lectura de la bandera sin depender de RLS del llamante
CREATE OR REPLACE FUNCTION public.cliente_requiere_autorizacion(p_cliente_id uuid, p_tipo text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req boolean;
BEGIN
  IF p_cliente_id IS NULL THEN
    RETURN true; -- sin cliente asociado: se exige autorización (comportamiento actual)
  END IF;
  IF p_tipo NOT IN ('cotizacion','proforma') THEN
    RAISE EXCEPTION 'LC_TIPO_AUTORIZACION_INVALIDO: use cotizacion o proforma' USING ERRCODE = 'check_violation';
  END IF;

  IF p_tipo = 'cotizacion' THEN
    SELECT c.requiere_autorizacion_cotizacion INTO v_req
      FROM public.clientes c WHERE c.id = p_cliente_id;
  ELSE
    SELECT c.requiere_autorizacion_proforma INTO v_req
      FROM public.clientes c WHERE c.id = p_cliente_id;
  END IF;

  RETURN COALESCE(v_req, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cliente_requiere_autorizacion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cliente_requiere_autorizacion(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cliente_requiere_autorizacion(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_requiere_autorizacion(uuid, text) TO service_role;

-- Aceptación de cotización: permitir Borrador cuando el cliente no requiere autorización
CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
  v_cliente_id UUID; v_requiere BOOLEAN; v_origen TEXT;
BEGIN
  SELECT version, organization_id, folio, estado::text, fecha_vigencia, cliente_id
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia, v_cliente_id
    FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;

  v_requiere := public.cliente_requiere_autorizacion(v_cliente_id, 'cotizacion');
  v_origen := CASE WHEN v_requiere THEN 'autorizacion_cliente' ELSE 'interna_cliente_de_casa' END;

  IF v_requiere THEN
    IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %, estados_permitidos: [Borrador, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Enviada';
    END IF;
  ELSE
    IF v_estado_actual NOT IN ('Borrador','Solicitada','Enviada') THEN
      RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Solicitada/Enviada (actual: %, estados_permitidos: [Borrador, Solicitada, Enviada])', v_estado_actual
        USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Solicitada,Enviada';
    END IF;
  END IF;

  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual,'origen_aceptacion',v_origen));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version,'origen_aceptacion',v_origen);
END;
$function$;

-- Aceptación automática de proforma para clientes que no requieren autorización
CREATE OR REPLACE FUNCTION public.aceptar_proforma_sin_autorizacion(p_proforma_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_p public.proformas%ROWTYPE;
  v_email text;
BEGIN
  SELECT * INTO v_p FROM public.proformas WHERE id = p_proforma_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA: la proforma no existe' USING ERRCODE='P0002';
  END IF;
  IF v_p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: la proforma fue eliminada' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_p.organization_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: no perteneces a la organización de esta proforma' USING ERRCODE='42501';
  END IF;
  IF public.cliente_requiere_autorizacion(v_p.cliente_id, 'proforma') THEN
    RAISE EXCEPTION 'LC_PROFORMA_REQUIERE_AUTORIZACION: este cliente sí requiere autorización de proformas' USING ERRCODE='P0001';
  END IF;

  IF COALESCE(v_p.estado_cliente,'pendiente') = 'aceptada' THEN
    RETURN jsonb_build_object('proforma_id', p_proforma_id, 'estado_cliente', 'aceptada', 'sin_cambios', true);
  END IF;

  UPDATE public.proformas
     SET estado_cliente = 'aceptada',
         aceptada_at = now(),
         aceptada_por = 'auto:sin_autorizacion_requerida',
         rechazada_at = NULL,
         updated_at = now()
   WHERE id = p_proforma_id;

  v_email := COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), '');
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_p.organization_id, auth.uid(), v_email,
    'proforma.aceptada_sin_autorizacion','proformas',
    p_proforma_id, COALESCE(v_p.numero,''),
    jsonb_build_object('estado_cliente_previo', COALESCE(v_p.estado_cliente,'pendiente'),
                       'origen_aceptacion','auto_cliente_de_casa'));

  RETURN jsonb_build_object('proforma_id', p_proforma_id, 'estado_cliente', 'aceptada', 'sin_cambios', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.aceptar_proforma_sin_autorizacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aceptar_proforma_sin_autorizacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aceptar_proforma_sin_autorizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_proforma_sin_autorizacion(uuid) TO service_role;