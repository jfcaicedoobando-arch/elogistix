-- P1 · Auditoría IVA — tasa canónica por tratamiento al convertir proforma → factura.
CREATE OR REPLACE FUNCTION public._tasa_iva_canonica(
  p_tipo_iva text,
  p_tasa_iva_aplicada numeric,
  p_aplica_iva boolean,
  p_tasa_global numeric DEFAULT 0.16
) RETURNS numeric
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'public'
AS $$
  -- Una sola regla, igual que resolverTasaConcepto() en el frontend:
  --   el TRATAMIENTO explícito manda; una tasa numérica ausente o
  --   contradictoria NUNCA se resuelve con la tasa general.
  -- Sólo el renglón legacy SIN tipo_iva conserva el fallback histórico.
  SELECT CASE
    WHEN p_tipo_iva = 'gravado_16' THEN p_tasa_global
    WHEN p_tipo_iva = 'gravado_8'  THEN 0.08
    WHEN p_tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
    WHEN p_aplica_iva IS FALSE THEN 0
    ELSE COALESCE(p_tasa_iva_aplicada, p_tasa_global)
  END;
$$;

REVOKE ALL ON FUNCTION public._tasa_iva_canonica(text, numeric, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._tasa_iva_canonica(text, numeric, boolean, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public._tasa_iva_canonica(text, numeric, boolean, numeric) TO service_role;

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
           -- El tipo explícito manda; 'no_objeto' (SAT 01) no es inferible.
           CASE WHEN pcc.tipo_iva IS NOT NULL THEN pcc.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  pcc.aplica_iva,
                  CASE WHEN pcc.aplica_iva = false THEN NULL ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END)
           END,
           -- P1 · Auditoría IVA: la tasa la manda el TRATAMIENTO (canónica);
           -- una tasa numérica ausente o contradictoria ya no se resuelve al 16%.
           CASE WHEN pcc.tipo_iva = 'no_objeto' THEN NULL
                WHEN pcc.aplica_iva = false THEN NULL
                ELSE public._tasa_iva_canonica(pcc.tipo_iva, pcc.tasa_iva_aplicada, pcc.aplica_iva) END,
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
           CASE WHEN cv.tipo_iva IS NOT NULL THEN cv.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  cv.aplica_iva,
                  CASE WHEN cv.aplica_iva = false THEN NULL ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END)
           END,
           CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
                WHEN cv.aplica_iva = false THEN NULL
                ELSE public._tasa_iva_canonica(cv.tipo_iva, cv.tasa_iva_aplicada, cv.aplica_iva) END,
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