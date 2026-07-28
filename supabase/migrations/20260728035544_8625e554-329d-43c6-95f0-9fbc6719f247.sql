-- v13.320.33 · Wave 2 backend fixes (B-016, B-040, B-045, B-062)

-- ============================================================================
-- B-016 + B-040 — duplicar_cotizacion: copiar precio_venta y usar folio atómico
-- ============================================================================
CREATE OR REPLACE FUNCTION public.duplicar_cotizacion(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_nueva_id uuid := gen_random_uuid();
  v_folio text;
BEGIN
  SELECT organization_id INTO v_org FROM public.cotizaciones WHERE id = p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'No pertenece a tu organización' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador')) THEN
    RAISE EXCEPTION 'Rol insuficiente para duplicar cotizaciones' USING ERRCODE = '42501';
  END IF;

  -- B-040: folio atómico (misma vía que "crear"). Antes usaba MAX(folio)+1
  -- lexicográfico, con race entre duplicados concurrentes y colisión permanente
  -- tras COT-YYYY-9999 ('10000' < '9999' comparado como texto).
  v_folio := public.siguiente_folio_cotizacion();

  INSERT INTO public.cotizaciones AS c
  SELECT
    v_nueva_id           AS id,
    v_folio              AS folio,
    cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, origen, destino,
    conceptos_venta, subtotal, moneda, vigencia_dias,
    NULL::date           AS fecha_vigencia,
    notas,
    'Borrador'::estado_cotizacion AS estado,
    NULL::uuid           AS embarque_id,
    operador,
    now()                AS created_at,
    now()                AS updated_at
  FROM public.cotizaciones
  WHERE id = p_id;

  UPDATE public.cotizaciones
     SET organization_id = v_org,
         duplicada_de_id = p_id
   WHERE id = v_nueva_id;

  -- B-016: incluir precio_venta (y campos monetarios auxiliares si existen)
  -- para que la columna generada `profit` del duplicado nazca correcta.
  INSERT INTO public.cotizacion_costos
    (cotizacion_id, concepto, moneda, proveedor, cantidad,
     costo_unitario, precio_venta, tipo_cambio_usd)
  SELECT v_nueva_id, concepto, moneda, proveedor, cantidad,
         costo_unitario, precio_venta, tipo_cambio_usd
    FROM public.cotizacion_costos
   WHERE cotizacion_id = p_id;

  RETURN v_nueva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicar_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_cotizacion(uuid) TO authenticated, service_role;

-- ============================================================================
-- B-045 — _cxp_validar_aprobacion: reemplazar el placeholder literal %.2f
-- RAISE no soporta %.2f — solo %s/%L/%I; los importes se formatean con to_char.
-- ============================================================================
CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > 0.01 THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: %',
      to_char(v_suma_conceptos,         'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,             'FM999,999,999,990.00');
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid) TO authenticated, service_role;

-- ============================================================================
-- B-062 — busqueda_global: matchear también proveedor_facturas.folio_interno
-- ============================================================================
CREATE OR REPLACE FUNCTION public.busqueda_global(termino text, limite integer DEFAULT 5)
 RETURNS TABLE(id uuid, label text, sublabel text, tipo text, url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
   (SELECT DISTINCT ON (e.expediente)
           e.id, e.expediente AS label,
           (e.cliente_nombre
             || CASE
                  WHEN e.bl_master IS NOT NULL AND e.bl_master ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/M ' || e.bl_master
                  WHEN e.bl_house IS NOT NULL AND e.bl_house ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/H ' || e.bl_house
                  WHEN COUNT(*) OVER (PARTITION BY e.expediente) > 1
                    THEN ' · ' || COUNT(*) OVER (PARTITION BY e.expediente) || ' contenedores'
                  ELSE ''
                END) AS sublabel,
           'embarque'::text AS tipo,
           '/embarques/' || e.id AS url
    FROM embarques e
    WHERE (e.expediente ILIKE '%' || termino || '%'
           OR e.bl_master ILIKE '%' || termino || '%'
           OR e.bl_house  ILIKE '%' || termino || '%')
      AND e.deleted_at IS NULL
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    ORDER BY e.expediente, e.created_at ASC
    LIMIT limite)
   UNION ALL
   (SELECT cl.id, cl.nombre AS label, cl.rfc AS sublabel, 'cliente'::text AS tipo, '/clientes/' || cl.id AS url
    FROM clientes cl WHERE (cl.nombre ILIKE '%' || termino || '%' OR cl.rfc ILIKE '%' || termino || '%')
      AND cl.deleted_at IS NULL
      AND (cl.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT p.id, p.nombre AS label, p.rfc AS sublabel, 'proveedor'::text AS tipo, '/proveedores/' || p.id AS url
    FROM proveedores p WHERE (p.nombre ILIKE '%' || termino || '%' OR p.rfc ILIKE '%' || termino || '%')
      AND (p.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT f.id, f.numero AS label, f.cliente_nombre AS sublabel, 'factura'::text AS tipo, '/facturacion/' || f.id AS url
    FROM facturas f WHERE (f.numero ILIKE '%' || termino || '%' OR f.cliente_nombre ILIKE '%' || termino || '%')
      AND f.deleted_at IS NULL
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT c.id, c.folio AS label, c.cliente_nombre AS sublabel, 'cotizacion'::text AS tipo, '/cotizaciones/' || c.id AS url
    FROM cotizaciones c WHERE (c.folio ILIKE '%' || termino || '%' OR c.cliente_nombre ILIKE '%' || termino || '%' OR c.prospecto_empresa ILIKE '%' || termino || '%')
      AND c.deleted_at IS NULL
      AND (c.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT pr.id, pr.numero AS label,
           (pr.cliente_nombre || ' · ' || pr.expediente) AS sublabel,
           'proforma'::text AS tipo,
           '/proformas/' || pr.id AS url
    FROM proformas pr
    WHERE (pr.numero ILIKE '%' || termino || '%'
           OR pr.cliente_nombre ILIKE '%' || termino || '%'
           OR pr.expediente ILIKE '%' || termino || '%')
      AND pr.deleted_at IS NULL
      AND (pr.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   -- B-062: matchear también por folio_interno (FI-…) — es el folio que la UI
   -- muestra en todas las listas CxP; buscar por él antes devolvía vacío.
   (SELECT pf.id,
           COALESCE(pf.folio_interno, pf.folio_proveedor) AS label,
           (pf.proveedor_nombre
              || COALESCE(' · ' || pv.rfc, '')
              || CASE
                   WHEN pf.folio_interno IS NOT NULL AND pf.folio_proveedor IS NOT NULL
                        AND pf.folio_interno IS DISTINCT FROM pf.folio_proveedor
                     THEN ' · Prov ' || pf.folio_proveedor
                   ELSE ''
                 END) AS sublabel,
           'factura_proveedor'::text AS tipo,
           '/cxp?factura=' || pf.id AS url
    FROM proveedor_facturas pf
    LEFT JOIN proveedores pv ON pv.id = pf.proveedor_id
    WHERE pf.estado <> 'Cancelada'
      AND pf.deleted_at IS NULL
      AND (pf.folio_proveedor ILIKE '%' || termino || '%'
           OR pf.folio_interno ILIKE '%' || termino || '%'
           OR pf.proveedor_nombre ILIKE '%' || termino || '%'
           OR pv.rfc ILIKE '%' || termino || '%')
      AND (pf.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite);
$function$;

REVOKE ALL ON FUNCTION public.busqueda_global(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.busqueda_global(text, integer) TO authenticated, service_role;