-- v13.348.0 — Feed unificado de actividad del embarque (corrección de usuarios).
DROP FUNCTION IF EXISTS public.actividad_embarque(uuid);

CREATE FUNCTION public.actividad_embarque(p_embarque_id uuid)
RETURNS TABLE (
  id text,
  categoria text,
  tipo text,
  fecha timestamptz,
  usuario text,
  accion text,
  titulo text,
  descripcion text,
  monto numeric,
  moneda text,
  ref_tipo text,
  ref_id uuid,
  dedupe_key text,
  detalles jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_exp text;
  v_cot uuid;
  v_fin boolean;
BEGIN
  SELECT e.organization_id, e.expediente, e.cotizacion_id
    INTO v_org, v_exp, v_cot
  FROM public.embarques e
  WHERE e.id = p_embarque_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_NOT_FOUND: embarque inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.is_org_member(v_org)) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_fin := public.can_view_financials(auth.uid());

  RETURN QUERY
  WITH facturas_emb AS (
    SELECT f.*
    FROM public.facturas f
    JOIN public.factura_embarques fe ON fe.factura_id = f.id
    WHERE fe.embarque_id = p_embarque_id
      AND COALESCE(fe.activa, true)
      AND f.deleted_at IS NULL
  ),
  pf_emb AS (
    SELECT pf.* FROM public.proveedor_facturas pf
    WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL
  ),
  prof_emb AS (
    SELECT pr.* FROM public.proformas pr
    WHERE pr.embarque_id = p_embarque_id AND pr.deleted_at IS NULL
  ),
  gar_emb AS (
    SELECT g.id FROM public.embarque_garantias_contenedor g
    WHERE g.embarque_id = p_embarque_id AND g.deleted_at IS NULL
  ),
  feed (f_id, f_categoria, f_tipo, f_fecha, f_usuario, f_accion, f_titulo,
        f_descripcion, f_monto, f_moneda, f_ref_tipo, f_ref_id, f_dedupe, f_detalles) AS (
    -- 1. Notas manuales
    SELECT ('nota-' || n.id)::text, 'operacion'::text, 'nota'::text, n.fecha,
           COALESCE(n.usuario, '')::text,
           CASE WHEN n.tipo = 'cambio_estado' THEN 'Cambio de estado' ELSE 'Nota' END::text,
           n.contenido::text, NULL::text, NULL::numeric, NULL::text,
           'embarque'::text, p_embarque_id,
           CASE WHEN n.tipo = 'cambio_estado'
                THEN 'estado|' || to_char(n.fecha, 'YYYYMMDDHH24MI') END::text,
           NULL::jsonb
    FROM public.notas_embarque n
    WHERE n.embarque_id = p_embarque_id AND n.deleted_at IS NULL

    -- 2. Eventos de tracking
    UNION ALL
    SELECT ('ev-' || ev.id), 'operacion', 'evento', ev.fecha, COALESCE(ev.usuario, ''),
           ev.tipo::text, COALESCE(NULLIF(ev.descripcion, ''), ev.tipo::text),
           NULLIF(ev.ubicacion, ''), NULL, NULL, 'embarque', p_embarque_id,
           CASE WHEN ev.descripcion ILIKE 'Estado cambiado a%'
                THEN 'estado|' || to_char(ev.fecha, 'YYYYMMDDHH24MI') END,
           NULL
    FROM public.eventos_embarque ev
    WHERE ev.embarque_id = p_embarque_id

    -- 3. Documentos del expediente
    UNION ALL
    SELECT ('doc-' || d.id), 'operacion', 'documento', d.created_at, '',
           'Documento', d.nombre, NULLIF(d.estado::text, ''), NULL, NULL,
           'documento', d.id, NULL, jsonb_build_object('archivo', d.archivo)
    FROM public.documentos_embarque d
    WHERE d.embarque_id = p_embarque_id AND d.deleted_at IS NULL

    -- 4. Bitácora del embarque (incluye legacy sin entidad_id)
    UNION ALL
    SELECT ('bit-' || b.id), 'operacion', 'bitacora', b.created_at,
           COALESCE(b.usuario_email, ''), b.accion, b.accion, NULL, NULL, NULL,
           'embarque', p_embarque_id,
           CASE WHEN b.accion = 'cambiar_estado'
                THEN 'estado|' || to_char(b.created_at, 'YYYYMMDDHH24MI') END,
           b.detalles
    FROM public.bitacora_actividad b
    WHERE b.entidad_id = p_embarque_id
       OR (b.entidad_id IS NULL AND v_exp IS NOT NULL AND b.entidad_nombre = v_exp)

    -- 5. Consultas de rastreo externas
    UNION ALL
    SELECT ('trk-' || t.id), 'operacion', 'tracking', t.created_at,
           COALESCE(t.usuario_email, ''),
           t.accion, 'Consulta de rastreo (' || COALESCE(t.provider, 'n/d') || ')',
           NULLIF(t.mensaje, ''), NULL, NULL, 'embarque', p_embarque_id, NULL, t.detalle
    FROM public.tracking_intentos t
    WHERE t.embarque_id = p_embarque_id

    -- 6. Cotización de origen
    UNION ALL
    SELECT ('cot-' || c.id), 'comercial', 'cotizacion', c.created_at, '',
           'Cotización creada', 'Cotización ' || COALESCE(c.folio, ''), NULL,
           CASE WHEN v_fin THEN c.subtotal END, c.moneda::text, 'cotizacion', c.id, NULL, NULL
    FROM public.cotizaciones c
    WHERE v_cot IS NOT NULL AND c.id = v_cot

    UNION ALL
    SELECT ('cot-ac-' || c.id), 'comercial', 'cotizacion', c.fecha_aceptacion, '',
           'Cotización aceptada', 'Cotización ' || COALESCE(c.folio, ''), NULL,
           NULL, NULL, 'cotizacion', c.id, NULL, NULL
    FROM public.cotizaciones c
    WHERE v_cot IS NOT NULL AND c.id = v_cot AND c.fecha_aceptacion IS NOT NULL

    UNION ALL
    SELECT ('bitc-' || b.id), 'comercial', 'bitacora', b.created_at,
           COALESCE(b.usuario_email, ''), b.accion, 'Cotización: ' || b.accion, NULL,
           NULL, NULL, 'cotizacion', v_cot, NULL, b.detalles
    FROM public.bitacora_actividad b
    WHERE v_cot IS NOT NULL AND b.entidad_id = v_cot

    -- 7. Proformas
    UNION ALL
    SELECT ('prof-' || pr.id), 'finanzas', 'proforma', pr.created_at, COALESCE(u.email, ''),
           'Proforma generada', 'Proforma ' || COALESCE(pr.numero, ''), NULL,
           CASE WHEN v_fin THEN pr.total_usd END, 'USD', 'proforma', pr.id, NULL, NULL
    FROM prof_emb pr LEFT JOIN auth.users u ON u.id = pr.created_by

    UNION ALL
    SELECT ('prof-env-' || pr.id), 'finanzas', 'proforma', pr.enviada_at,
           COALESCE(u.email, ''), 'Proforma enviada',
           'Proforma ' || COALESCE(pr.numero, '') || ' enviada al cliente', NULL,
           NULL, NULL, 'proforma', pr.id, NULL, NULL
    FROM prof_emb pr LEFT JOIN auth.users u ON u.id = pr.enviada_por
    WHERE pr.enviada_at IS NOT NULL

    UNION ALL
    SELECT ('prof-res-' || pr.id), 'finanzas', 'proforma',
           COALESCE(pr.aceptada_at, pr.rechazada_at), COALESCE(pr.aceptada_por, ''),
           CASE WHEN pr.aceptada_at IS NOT NULL THEN 'Proforma aceptada' ELSE 'Proforma rechazada' END,
           'Proforma ' || COALESCE(pr.numero, ''), NULLIF(pr.motivo_rechazo, ''),
           NULL, NULL, 'proforma', pr.id, NULL, NULL
    FROM prof_emb pr WHERE pr.aceptada_at IS NOT NULL OR pr.rechazada_at IS NOT NULL

    UNION ALL
    SELECT ('bitp-' || b.id), 'finanzas', 'bitacora', b.created_at,
           COALESCE(b.usuario_email, ''), b.accion, 'Proforma: ' || b.accion, NULL,
           NULL, NULL, 'proforma', b.entidad_id, NULL, b.detalles
    FROM public.bitacora_actividad b
    WHERE b.entidad_id IN (SELECT pr.id FROM prof_emb pr)

    -- 8. Facturas al cliente
    UNION ALL
    SELECT ('fac-' || f.id), 'finanzas', 'factura', f.created_at, '',
           'Factura creada',
           'Factura ' || COALESCE(f.serie, '') || COALESCE(f.numero::text, '') || ' · ' || f.estado::text,
           NULL, CASE WHEN v_fin THEN f.total END, f.moneda::text, 'factura', f.id, NULL, NULL
    FROM facturas_emb f

    UNION ALL
    SELECT ('fac-tim-' || f.id), 'finanzas', 'factura', f.timbrado_en,
           COALESCE(u.email, ''), 'Factura timbrada',
           'Factura ' || COALESCE(f.serie, '') || COALESCE(f.numero::text, ''),
           NULLIF(f.uuid_fiscal, ''), CASE WHEN v_fin THEN f.total END, f.moneda::text,
           'factura', f.id, NULL, NULL
    FROM facturas_emb f LEFT JOIN auth.users u ON u.id = f.timbrado_por
    WHERE f.timbrado_en IS NOT NULL

    UNION ALL
    SELECT ('fac-can-' || f.id), 'finanzas', 'factura', f.cancelado_en, '',
           'Factura cancelada',
           'Factura ' || COALESCE(f.serie, '') || COALESCE(f.numero::text, ''),
           NULLIF(f.cancelacion_motivo, ''), NULL, NULL, 'factura', f.id, NULL, NULL
    FROM facturas_emb f WHERE f.cancelado_en IS NOT NULL

    UNION ALL
    SELECT ('fac-mail-' || fe2.id), 'finanzas', 'email', fe2.created_at,
           COALESCE(u.email, ''), 'Factura enviada por correo',
           COALESCE(fe2.asunto, 'Envío de factura'),
           array_to_string(fe2.destinatarios, ', '), NULL, NULL, 'factura', fe2.factura_id,
           NULL, jsonb_build_object('estado', fe2.estado, 'error', fe2.error)
    FROM public.factura_envios fe2
    LEFT JOIN auth.users u ON u.id = fe2.enviado_por
    WHERE fe2.factura_id IN (SELECT f.id FROM facturas_emb f)

    UNION ALL
    SELECT ('bitf-' || b.id), 'finanzas', 'bitacora', b.created_at,
           COALESCE(b.usuario_email, ''), b.accion, 'Factura: ' || b.accion, NULL,
           NULL, NULL, 'factura', b.entidad_id, NULL, b.detalles
    FROM public.bitacora_actividad b
    WHERE b.entidad_id IN (SELECT f.id FROM facturas_emb f)

    -- 9. Pagos de cliente
    UNION ALL
    SELECT ('pag-' || pg.id), 'finanzas', 'pago', COALESCE(pg.fecha_pago::timestamptz, pg.created_at),
           COALESCE(u.email, ''), 'Pago recibido',
           'Pago ' || COALESCE(pg.forma_pago, '') || COALESCE(' · ref ' || NULLIF(pg.referencia, ''), ''),
           NULL, CASE WHEN v_fin THEN pg.monto END, pg.moneda::text, 'factura', pg.factura_id, NULL, NULL
    FROM public.pagos_factura pg
    LEFT JOIN auth.users u ON u.id = pg.created_by
    WHERE pg.deleted_at IS NULL
      AND (pg.embarque_id = p_embarque_id OR pg.factura_id IN (SELECT f.id FROM facturas_emb f))

    -- 10. Notas de crédito
    UNION ALL
    SELECT ('nc-' || nc.id), 'finanzas', 'nota_credito', nc.created_at,
           COALESCE(u.email, ''), 'Nota de crédito ' || nc.estado::text,
           'NC ' || COALESCE(nc.folio, '') || ' · ' || nc.motivo::text,
           NULLIF(nc.descripcion, ''), CASE WHEN v_fin THEN nc.monto END, nc.moneda::text,
           'factura', nc.factura_id, NULL, NULL
    FROM public.factura_notas_credito nc
    LEFT JOIN auth.users u ON u.id = nc.created_by
    WHERE nc.deleted_at IS NULL AND nc.factura_id IN (SELECT f.id FROM facturas_emb f)

    -- 11. Facturas de proveedor
    UNION ALL
    SELECT ('pf-' || pf.id), 'finanzas', 'cxp', pf.created_at, COALESCE(u.email, ''),
           'Factura de proveedor capturada',
           COALESCE(pf.folio_interno, pf.folio_proveedor, 'CxP') || ' · ' || COALESCE(pf.proveedor_nombre, ''),
           NULL, CASE WHEN v_fin THEN pf.total END, pf.moneda::text, 'cxp', pf.id, NULL, NULL
    FROM pf_emb pf LEFT JOIN auth.users u ON u.id = pf.created_by

    UNION ALL
    SELECT ('pf-apr-' || pf.id), 'finanzas', 'cxp', pf.aprobada_at, COALESCE(u.email, ''),
           'Factura de proveedor ' || pf.estado_aprobacion::text,
           COALESCE(pf.folio_interno, pf.folio_proveedor, 'CxP'),
           NULLIF(pf.motivo_rechazo, ''), NULL, NULL, 'cxp', pf.id, NULL, NULL
    FROM pf_emb pf LEFT JOIN auth.users u ON u.id = pf.aprobada_por
    WHERE pf.aprobada_at IS NOT NULL

    UNION ALL
    SELECT ('bitx-' || b.id), 'finanzas', 'bitacora', b.created_at,
           COALESCE(b.usuario_email, ''), b.accion, 'CxP: ' || b.accion, NULL,
           NULL, NULL, 'cxp', b.entidad_id, NULL, b.detalles
    FROM public.bitacora_actividad b
    WHERE b.entidad_id IN (SELECT pf.id FROM pf_emb pf)

    -- 12. Pagos a proveedor
    UNION ALL
    SELECT ('pp-' || pp.id), 'finanzas', 'pago_proveedor',
           COALESCE(pp.fecha_pago::timestamptz, pp.created_at), COALESCE(u.email, ''),
           'Pago a proveedor',
           COALESCE(pp.metodo_pago, '') || COALESCE(' · ref ' || NULLIF(pp.referencia, ''), ''),
           NULL, CASE WHEN v_fin THEN pp.monto END, pp.moneda::text, 'cxp', pp.proveedor_factura_id,
           NULL, NULL
    FROM public.pagos_proveedor pp
    LEFT JOIN auth.users u ON u.id = pp.created_by
    WHERE pp.deleted_at IS NULL AND pp.proveedor_factura_id IN (SELECT pf.id FROM pf_emb pf)

    -- 13. Buzón de invoices (facturas entrantes)
    UNION ALL
    SELECT ('fe-' || fe3.id), 'finanzas', 'buzon', fe3.created_at, COALESCE(u.email, ''),
           'Invoice recibido', COALESCE(fe3.nombre_archivo, 'Archivo'), NULLIF(fe3.nota, ''),
           CASE WHEN v_fin THEN fe3.total_detectado END, fe3.moneda_detectada,
           'buzon', fe3.id, NULL, NULL
    FROM public.embarque_facturas_entrantes fe3
    LEFT JOIN auth.users u ON u.id = fe3.subido_por
    WHERE fe3.embarque_id = p_embarque_id AND fe3.deleted_at IS NULL

    UNION ALL
    SELECT ('fe-cap-' || fe4.id), 'finanzas', 'buzon', fe4.updated_at, COALESCE(u.email, ''),
           CASE WHEN fe4.estado = 'rechazada' THEN 'Invoice rechazado' ELSE 'Invoice capturado' END,
           COALESCE(fe4.nombre_archivo, 'Archivo'), NULLIF(fe4.rechazo_motivo, ''),
           NULL, NULL, 'buzon', fe4.id, NULL, NULL
    FROM public.embarque_facturas_entrantes fe4
    LEFT JOIN auth.users u ON u.id = fe4.capturado_por
    WHERE fe4.embarque_id = p_embarque_id AND fe4.deleted_at IS NULL
      AND fe4.estado <> 'por_capturar'

    -- 14. Historial de garantías
    UNION ALL
    SELECT ('gar-' || gh.id), 'riesgo', 'garantia', gh.changed_at, COALESCE(u.email, ''),
           'Garantía: ' || COALESCE(gh.estado_anterior, 'nueva') || ' → ' || gh.estado_nuevo,
           'Garantía de contenedor', NULLIF(gh.notas, ''),
           CASE WHEN v_fin THEN gh.monto_deposito_usd END, 'USD', 'garantia', gh.garantia_id, NULL, NULL
    FROM public.embarque_garantias_historial gh
    LEFT JOIN auth.users u ON u.id = gh.changed_by
    WHERE gh.garantia_id IN (SELECT g.id FROM gar_emb g)

    -- 15. Seguros
    UNION ALL
    SELECT ('seg-' || s.id), 'riesgo', 'seguro', s.created_at, COALESCE(u.email, ''),
           'Seguro registrado',
           COALESCE(s.aseguradora, 'Póliza') || COALESCE(' · ' || NULLIF(s.numero_poliza, ''), ''),
           NULLIF(s.cobertura_descripcion, ''), CASE WHEN v_fin THEN s.suma_asegurada END,
           s.moneda::text, 'seguro', s.id, NULL, NULL
    FROM public.seguros_embarque s
    LEFT JOIN auth.users u ON u.id = s.created_by
    WHERE s.embarque_id = p_embarque_id AND s.deleted_at IS NULL

    -- 16. Cierres y reaperturas
    UNION ALL
    SELECT ('cie-' || cl.id), 'cierre', 'cierre', cl.created_at, COALESCE(u.email, ''),
           CASE WHEN cl.accion = 'cerrar' THEN 'Embarque cerrado' ELSE 'Embarque reabierto' END,
           CASE WHEN cl.accion = 'cerrar' THEN 'Cierre financiero' ELSE 'Reapertura' END,
           NULLIF(cl.motivo, ''), NULL, NULL, 'embarque', p_embarque_id, NULL, NULL
    FROM public.cierre_embarque_log cl
    LEFT JOIN auth.users u ON u.id = cl.usuario_id
    WHERE cl.embarque_id = p_embarque_id
  )
  SELECT f_id, f_categoria, f_tipo, f_fecha, f_usuario, f_accion, f_titulo,
         f_descripcion, f_monto, f_moneda, f_ref_tipo, f_ref_id, f_dedupe, f_detalles
  FROM feed
  WHERE f_fecha IS NOT NULL
  ORDER BY f_fecha DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.actividad_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actividad_embarque(uuid) TO authenticated;