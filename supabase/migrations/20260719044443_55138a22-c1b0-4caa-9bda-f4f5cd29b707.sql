
-- =========================================================================
-- Fase P.3 (v13.301.89) — Retención garantía → factura de proveedor
-- =========================================================================

CREATE OR REPLACE FUNCTION public.materializar_factura_retencion_garantia(
  p_garantia_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_garantia record;
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_naviera_nombre text;
  v_proveedor_id uuid;
  v_proveedor_nombre text;
  v_categoria_id uuid;
  v_folio text;
  v_factura_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_ROL';
  END IF;

  IF public.has_role(v_uid, 'admin')
     OR public.has_role(v_uid, 'admin_org')
     OR public.has_role(v_uid, 'operador')
     OR public.has_role(v_uid, 'super_admin') THEN
    v_ok := true;
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_ROL';
  END IF;

  SELECT * INTO v_garantia
  FROM public.embarque_garantias_contenedor
  WHERE id = p_garantia_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_GARANTIA_NO_ENCONTRADA';
  END IF;

  IF v_garantia.estado <> 'retenido' THEN
    RAISE EXCEPTION 'LC_GARANTIA_NO_RETENIDA';
  END IF;

  IF v_garantia.proveedor_factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_GARANTIA_FACTURA_YA_MATERIALIZADA';
  END IF;

  IF v_garantia.naviera_id IS NULL THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_NAVIERA';
  END IF;

  SELECT name INTO v_naviera_nombre FROM public.navieras WHERE id = v_garantia.naviera_id;

  SELECT id, nombre INTO v_proveedor_id, v_proveedor_nombre
  FROM public.proveedores
  WHERE organization_id = v_garantia.organization_id
    AND lower(nombre) = lower(v_naviera_nombre)
  LIMIT 1;

  IF v_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_PROVEEDOR_NAVIERA';
  END IF;

  SELECT id INTO v_categoria_id
  FROM public.presupuesto_categorias
  WHERE organization_id = v_garantia.organization_id
    AND (lower(nombre) LIKE 'costo%' OR lower(nombre) LIKE '%cogs%')
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_categoria_id IS NULL THEN
    SELECT id INTO v_categoria_id
    FROM public.presupuesto_categorias
    WHERE organization_id = v_garantia.organization_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  IF v_categoria_id IS NULL THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_CATEGORIA_PRESUPUESTO';
  END IF;

  v_folio := public.siguiente_folio_proveedor(v_garantia.organization_id);

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, proveedor_nombre, embarque_id,
    folio_proveedor, fecha_emision, dias_credito,
    moneda, tipo_cambio_usd,
    subtotal, iva, retenciones, total,
    estado, notas, categoria_presupuesto_id, folio_interno, created_by
  ) VALUES (
    v_garantia.organization_id, v_proveedor_id, v_proveedor_nombre, v_garantia.embarque_id,
    'RET-GAR-' || substr(v_garantia.id::text, 1, 8),
    CURRENT_DATE, 0,
    'USD', 1,
    v_garantia.monto_deposito_usd, 0, 0, v_garantia.monto_deposito_usd,
    'Borrador',
    'Retención automática de garantía #' || v_garantia.id::text,
    v_categoria_id, v_folio, v_uid
  ) RETURNING id INTO v_factura_id;

  UPDATE public.embarque_garantias_contenedor
     SET proveedor_factura_id = v_factura_id,
         updated_at = now()
   WHERE id = v_garantia.id;

  RETURN v_factura_id;
END;
$$;

REVOKE ALL ON FUNCTION public.materializar_factura_retencion_garantia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materializar_factura_retencion_garantia(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.materializar_factura_retencion_garantia(uuid) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.garantia_auto_materializar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prov_id uuid;
  v_naviera_nombre text;
BEGIN
  IF NEW.estado <> 'retenido' OR OLD.estado = 'retenido' THEN
    RETURN NEW;
  END IF;
  IF NEW.proveedor_factura_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.naviera_id IS NULL THEN
    UPDATE public.embarque_garantias_contenedor
       SET notas = COALESCE(notas || E'\n', '') || '[Retención pendiente de materializar: sin naviera]'
     WHERE id = NEW.id AND (notas IS NULL OR notas NOT LIKE '%pendiente de materializar%');
    RETURN NEW;
  END IF;

  SELECT name INTO v_naviera_nombre FROM public.navieras WHERE id = NEW.naviera_id;
  SELECT id INTO v_prov_id
  FROM public.proveedores
  WHERE organization_id = NEW.organization_id
    AND lower(nombre) = lower(v_naviera_nombre)
  LIMIT 1;

  IF v_prov_id IS NULL THEN
    UPDATE public.embarque_garantias_contenedor
       SET notas = COALESCE(notas || E'\n', '') || '[Retención pendiente de materializar: naviera sin proveedor mapeado]'
     WHERE id = NEW.id AND (notas IS NULL OR notas NOT LIKE '%pendiente de materializar%');
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.materializar_factura_retencion_garantia(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.embarque_garantias_contenedor
       SET notas = COALESCE(notas || E'\n', '') || '[Retención pendiente: ' || SQLERRM || ']'
     WHERE id = NEW.id AND (notas IS NULL OR notas NOT LIKE '%pendiente%');
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garantia_auto_materializar
  ON public.embarque_garantias_contenedor;

CREATE TRIGGER trg_garantia_auto_materializar
AFTER UPDATE OF estado ON public.embarque_garantias_contenedor
FOR EACH ROW EXECUTE FUNCTION public.garantia_auto_materializar();
