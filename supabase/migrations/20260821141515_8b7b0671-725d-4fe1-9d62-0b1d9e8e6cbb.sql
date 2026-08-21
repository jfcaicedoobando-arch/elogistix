DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'estado_documento' AND e.enumlabel = 'Rechazado'
  ) THEN
    ALTER TYPE public.estado_documento ADD VALUE 'Rechazado';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rechazar_documento_embarque(
  _doc_id uuid,
  _motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_emb record;
  v_motivo text := btrim(coalesce(_motivo, ''));
BEGIN
  PERFORM public._assert_writer();

  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'LC_MOTIVO_REQUERIDO: el motivo de rechazo debe tener al menos 5 caracteres'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_doc
  FROM public.documentos_embarque
  WHERE id = _doc_id
    AND deleted_at IS NULL
    AND organization_id = public.current_user_org_id();

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'LC_DOC_INEXISTENTE: el documento no existe o no pertenece a tu organización'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT id, expediente, created_by, organization_id INTO v_emb
  FROM public.embarques
  WHERE id = v_doc.embarque_id;

  UPDATE public.documentos_embarque
  SET estado = 'Rechazado'::public.estado_documento,
      archivo = NULL,
      notas = left(
        coalesce(nullif(btrim(coalesce(notas, '')), '') || E'\n', '')
        || 'Rechazado ' || to_char(now(), 'DD/MM/YYYY HH24:MI') || ': ' || v_motivo,
        2000)
  WHERE id = _doc_id;

  IF v_emb.created_by IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas (
      organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id
    ) VALUES (
      v_doc.organization_id,
      v_emb.created_by,
      'documento_rechazado',
      'Documento rechazado: ' || v_doc.nombre,
      'El documento "' || v_doc.nombre || '" del embarque ' || coalesce(v_emb.expediente, '') ||
        ' fue rechazado. Motivo: ' || v_motivo,
      '/embarques/' || v_doc.embarque_id::text,
      'embarque',
      v_doc.embarque_id
    );
  END IF;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, modulo, accion, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_doc.organization_id,
    auth.uid(),
    'documentos',
    'rechazar_documento',
    _doc_id,
    v_doc.nombre,
    jsonb_build_object('motivo', v_motivo, 'embarque_id', v_doc.embarque_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rechazar_documento_embarque(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_documento_embarque(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rechazar_documento_embarque(uuid, text) TO authenticated;