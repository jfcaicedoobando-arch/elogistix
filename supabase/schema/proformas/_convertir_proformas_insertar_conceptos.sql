-- Fuente canónica de public._convertir_proformas_insertar_conceptos (helper privado).
-- Extraído en Item 3.2 de arquitectura (v13.309.10) para des-duplicar los 4 bloques
-- de inserción de conceptos_factura desde proforma_conceptos_consolidados o conceptos_venta.
-- Defecto 1 (ronda posterior a v13.823.39): la clasificación fiscal del IVA se
-- delega en public._tipo_iva_desde_tasa para que el 8% de frontera no viaje al
-- CFDI como 16%.
-- B16 (v13.823.379): `aplica_iva = false` manda sobre una tasa legacy stale
-- (p. ej. 0.16): la línea se persiste exenta y con tasa NULL.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._convertir_proformas_insertar_conceptos(p_factura_id uuid, p_proforma_ids uuid[], p_org uuid, p_es_consolidada boolean, p_moneda moneda)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_es_consolidada THEN
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
           pcc.moneda, pcc.total, p_org,
           COALESCE(public.resolver_clave_sat(p_org, pcc.descripcion), '78101800'),
           -- B16: si la línea NO aplica IVA, se persiste exento y tasa NULL sin
           -- importar que arrastre una tasa legacy (p. ej. 0.16).
           public._tipo_iva_desde_tasa(
             pcc.aplica_iva,
             CASE WHEN pcc.aplica_iva = false THEN NULL ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END),
           CASE WHEN pcc.aplica_iva = false THEN NULL
                ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, pcc.proforma_id
    FROM public.proforma_conceptos_consolidados pcc
    JOIN public.proformas p ON p.id = pcc.proforma_id
    WHERE pcc.proforma_id = ANY(p_proforma_ids)
      AND pcc.moneda = p_moneda
      AND pcc.deleted_at IS NULL;
  ELSE
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
           -- BUG-17: el total del renglón se guarda redondeado a 2 decimales,
           -- igual que en la rama consolidada (pcc.total ya viene redondeado).
           cv.moneda, ROUND(cv.cantidad * cv.precio_unitario, 2), p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           public._tipo_iva_desde_tasa(
             cv.aplica_iva,
             CASE WHEN cv.aplica_iva = false THEN NULL ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END),
           CASE WHEN cv.aplica_iva = false THEN NULL
                ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, cv.proforma_id
    FROM public.conceptos_venta cv
    JOIN public.proformas p ON p.id = cv.proforma_id
    WHERE cv.proforma_id = ANY(p_proforma_ids)
      AND cv.moneda = p_moneda
      AND cv.deleted_at IS NULL;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) TO service_role;
