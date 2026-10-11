-- Candidato forward 20261011180000; CREATE OR REPLACE conserva ACL.
CREATE OR REPLACE FUNCTION public.aceptar_proforma_sin_autorizacion(p_proforma_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_p public.proformas%ROWTYPE;
  v_email text;
BEGIN
  SELECT * INTO v_p FROM public.proformas WHERE id = p_proforma_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA: la proforma no existe' USING ERRCODE='P0002';
  END IF;
  IF v_p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: la proforma fue eliminada' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_p.organization_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: no perteneces a la organización de esta proforma' USING ERRCODE='42501';
  END IF;
  IF v_p.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para continuar' USING ERRCODE='P0001';
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
$$;
