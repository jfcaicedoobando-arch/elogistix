-- Fuente canónica de public._convertir_proformas_insertar_conceptos (helper privado).
-- Extraído en Item 3.2 de arquitectura (v13.309.10) para des-duplicar los 4 bloques
-- de inserción de conceptos_factura desde proforma_conceptos_consolidados o conceptos_venta.
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
           CASE
             WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN 'exento'
             WHEN COALESCE(pcc.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
             ELSE 'gravado_16'
           END,
           CASE
             WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
             ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
           END,
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
           cv.moneda, cv.cantidad * cv.precio_unitario, p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           CASE
             WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN 'exento'
             WHEN COALESCE(cv.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
             ELSE 'gravado_16'
           END,
           CASE
             WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
             ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
           END,
           p.embarque_id, cv.proforma_id
    FROM public.conceptos_venta cv
    JOIN public.proformas p ON p.id = cv.proforma_id
    WHERE cv.proforma_id = ANY(p_proforma_ids)
      AND cv.moneda = p_moneda
      AND cv.deleted_at IS NULL;
  END IF;
END;
$function$

;
