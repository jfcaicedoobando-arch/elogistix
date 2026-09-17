-- IVA "No objeto de impuesto" (SAT ObjetoImp = 01)
-- =================================================
-- Migración PREPARADA (no aplicada). Idempotente: se puede correr varias veces.
--
-- Objetivo: que el tratamiento fiscal "no objeto" viaje explícito del catálogo
-- de productos y servicios a la cotización, la proforma y el CFDI, sin
-- confundirse con "Exento" ni con "Tasa 0%".
--
-- Reglas:
--  · `tipo_iva = 'no_objeto'` ⇒ la tasa se guarda NULL (no hay traslado).
--  · Los registros legacy NO se tocan: sin `tipo_iva` se sigue resolviendo por
--    `aplica_iva` + `tasa_iva_aplicada`.
--  · `_tipo_iva_desde_tasa` JAMÁS devuelve 'no_objeto' (no es inferible).

BEGIN;

-- 1) Catálogo maestro de productos y servicios ------------------------------
ALTER TABLE public.catalogo_claves_sat
  DROP CONSTRAINT IF EXISTS catalogo_claves_sat_tipo_iva_chk;
ALTER TABLE public.catalogo_claves_sat
  ADD CONSTRAINT catalogo_claves_sat_tipo_iva_chk
  CHECK (tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

-- No objeto y exento no llevan tasa de traslado.
ALTER TABLE public.catalogo_claves_sat
  DROP CONSTRAINT IF EXISTS catalogo_claves_sat_tasa_no_objeto_chk;
ALTER TABLE public.catalogo_claves_sat
  ADD CONSTRAINT catalogo_claves_sat_tasa_no_objeto_chk
  CHECK (tipo_iva <> 'no_objeto' OR COALESCE(tasa_iva_default, 0) = 0)
  NOT VALID;

-- 2) Conceptos de factura (renglones del CFDI) ------------------------------
ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_tipo_iva_check;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_tipo_iva_check
  CHECK (tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_no_objeto_sin_tasa_chk;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_no_objeto_sin_tasa_chk
  CHECK (tipo_iva <> 'no_objeto' OR tasa_iva_aplicada IS NULL)
  NOT VALID;

-- 3) Tratamiento fiscal explícito en venta y proforma -----------------------
ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS tipo_iva text;
ALTER TABLE public.conceptos_venta
  DROP CONSTRAINT IF EXISTS conceptos_venta_tipo_iva_chk;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_tipo_iva_chk
  CHECK (tipo_iva IS NULL OR tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));
COMMENT ON COLUMN public.conceptos_venta.tipo_iva IS
  'Tratamiento fiscal heredado del catálogo. NULL = legacy (resolver por aplica_iva/tasa_iva_aplicada). no_objeto = SAT ObjetoImp 01.';

ALTER TABLE public.proforma_conceptos_consolidados
  ADD COLUMN IF NOT EXISTS tipo_iva text;
ALTER TABLE public.proforma_conceptos_consolidados
  DROP CONSTRAINT IF EXISTS pcc_tipo_iva_chk;
ALTER TABLE public.proforma_conceptos_consolidados
  ADD CONSTRAINT pcc_tipo_iva_chk
  CHECK (tipo_iva IS NULL OR tipo_iva = ANY (ARRAY['gravado_16','gravado_8','tasa_0','exento','no_objeto']));

-- 4) Conversión proforma → factura: respetar el tipo explícito ---------------
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
           -- El tipo explícito manda; 'no_objeto' (SAT 01) no es inferible.
           CASE WHEN pcc.tipo_iva IS NOT NULL THEN pcc.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  pcc.aplica_iva,
                  CASE WHEN pcc.aplica_iva = false THEN NULL ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END)
           END,
           CASE WHEN pcc.tipo_iva = 'no_objeto' THEN NULL
                WHEN pcc.aplica_iva = false THEN NULL
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
           cv.moneda, ROUND(cv.cantidad * cv.precio_unitario, 2), p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           CASE WHEN cv.tipo_iva IS NOT NULL THEN cv.tipo_iva
                ELSE public._tipo_iva_desde_tasa(
                  cv.aplica_iva,
                  CASE WHEN cv.aplica_iva = false THEN NULL ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END)
           END,
           CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
                WHEN cv.aplica_iva = false THEN NULL
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

COMMIT;
