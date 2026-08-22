-- ============================================================
-- Ola de remediación (informe 2026-08-22) · Entrega 1
-- B-1  · is_org_member deja de devolver NULL (guard fail-closed)
-- B-1b · revertir_proforma_al_cancelar_sustitucion: usuario_email NOT NULL
-- B-3  · rechazar_documento_embarque: _assert_writer sin argumentos (42883)
-- ============================================================

-- B-1: la lógica trivaluada hacía que `IF NOT public.is_org_member(x)` no
-- disparara para usuarios sin organización (NULL = p_org -> NULL).
-- Se arregla en el helper: así queda cubierto en las 16 funciones que lo usan.
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.current_user_org_id() = p_org, false)
      OR COALESCE(public.has_role(auth.uid(), 'super_admin'::app_role), false);
$function$;

-- B-1b: la bitácora recibía usuario_email = NULL contra una columna NOT NULL,
-- así que ninguna reversión real funcionaba (23502).
CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion(p_factura_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_liberadas uuid[] := ARRAY[]::uuid[];
  v_facturas_vivas int;
  v_proforma_id_directa uuid;
  v_org uuid;
  v_uid uuid := auth.uid();
  v_email text := COALESCE(auth.email(), '');
BEGIN
  IF p_factura_id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_REQUERIDA: falta el identificador de la factura'
      USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, proforma_id INTO v_org, v_proforma_id_directa
  FROM public.facturas WHERE id = p_factura_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_NO_EXISTE: la factura no existe' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: sesión requerida' USING ERRCODE = '42501';
    END IF;
    IF public.is_org_member(v_org) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: la factura pertenece a otra organización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_proforma_id_directa IS NOT NULL THEN
    v_ids := array_append(v_ids, v_proforma_id_directa);
  END IF;

  v_ids := v_ids || COALESCE(
    (SELECT array_agg(DISTINCT proforma_id_origen)
       FROM public.conceptos_factura
      WHERE factura_id = p_factura_id
        AND deleted_at IS NULL
        AND proforma_id_origen IS NOT NULL),
    ARRAY[]::uuid[]
  );

  v_ids := array(
    SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL
  );

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN v_liberadas;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT count(*) INTO v_facturas_vivas
    FROM public.facturas f
    WHERE f.estado NOT IN ('Cancelada','Sustituida')
      AND f.id <> p_factura_id
      AND (
        f.proforma_id = v_id
        OR EXISTS (
          SELECT 1 FROM public.conceptos_factura cf
           WHERE cf.factura_id = f.id
             AND cf.deleted_at IS NULL
             AND cf.proforma_id_origen = v_id
        )
      );

    IF v_facturas_vivas = 0 THEN
      UPDATE public.proformas
         SET estado_proforma   = 'pendiente',
             fecha_facturacion = NULL,
             updated_at        = now()
       WHERE id = v_id
         AND organization_id = v_org
         AND estado_proforma = 'facturada';

      IF FOUND THEN
        v_liberadas := array_append(v_liberadas, v_id);
        INSERT INTO public.bitacora_actividad (
          organization_id, usuario_id, usuario_email,
          accion, modulo, entidad_id, entidad_nombre, detalles
        ) VALUES (
          v_org, COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid), v_email,
          'revertir_proforma_cancelacion_sustitucion', 'facturacion',
          v_id, NULL,
          jsonb_build_object('factura_id', p_factura_id)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_liberadas;
END;
$function$;

-- B-3 (+ M-8 parcial): `PERFORM public._assert_writer()` no existe como overload
-- sin argumentos -> 42883 en cada llamada. Además se protegen documentos
-- Validado y se homologa el mínimo del motivo con el front (10 caracteres).
CREATE OR REPLACE FUNCTION public.rechazar_documento_embarque(_doc_id uuid, _motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc record;
  v_emb record;
  v_motivo text := btrim(coalesce(_motivo, ''));
BEGIN
  IF length(v_motivo) < 10 THEN
    RAISE EXCEPTION 'LC_MOTIVO_REQUERIDO: el motivo de rechazo debe tener al menos 10 caracteres'
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

  PERFORM public._assert_writer(v_doc.organization_id);

  IF v_doc.estado = 'Validado'::public.estado_documento THEN
    RAISE EXCEPTION 'LC_DOC_VALIDADO: el documento ya fue validado; invalídalo antes de rechazarlo'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_doc.estado = 'Rechazado'::public.estado_documento THEN
    RAISE EXCEPTION 'LC_DOC_YA_RECHAZADO: el documento ya está rechazado'
      USING ERRCODE = 'check_violation';
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
    organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_doc.organization_id,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(auth.email(), ''),
    'documentos',
    'rechazar_documento',
    _doc_id,
    v_doc.nombre,
    jsonb_build_object('motivo', v_motivo, 'embarque_id', v_doc.embarque_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rechazar_documento_embarque(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rechazar_documento_embarque(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid) TO authenticated, service_role;