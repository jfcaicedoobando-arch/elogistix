-- Hallazgo 144: misma identidad UUID en validación, agrupación y acumulación.
CREATE OR REPLACE FUNCTION public._nc_validar_linaje_conceptos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  v_f record;
  v_fx numeric;
  v_otras numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.estado = 'Cancelada'
     OR jsonb_typeof(NEW.conceptos) IS DISTINCT FROM 'array' THEN
    RETURN NEW;
  END IF;
  SELECT moneda::text AS moneda, tipo_cambio INTO v_f FROM public.facturas WHERE id = NEW.factura_id;
  v_fx := public._nc_factor_moneda_factura(NEW.moneda::text, NEW.tipo_cambio, v_f.moneda, v_f.tipo_cambio);
  FOR r IN
    SELECT lower(btrim(l->>'concepto_factura_id')) AS cfid,
           SUM(round(COALESCE((l->>'cantidad')::numeric, 1) * COALESCE((l->>'precio_unitario')::numeric, 0), 2)) AS base
    FROM jsonb_array_elements(NEW.conceptos) l
    WHERE NULLIF(btrim(l->>'concepto_factura_id'), '') IS NOT NULL
    GROUP BY 1
  LOOP
    IF r.cfid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT EXISTS (
      SELECT 1 FROM public.conceptos_factura cf
      WHERE cf.id = r.cfid::uuid AND cf.factura_id = NEW.factura_id
        AND cf.organization_id = NEW.organization_id AND cf.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'LC_NC_LINAJE_INVALIDO: un renglón de la nota no pertenece a la factura.'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(SUM(round(COALESCE((l->>'cantidad')::numeric, 1) * COALESCE((l->>'precio_unitario')::numeric, 0), 2)
             * public._nc_factor_moneda_factura(o.moneda::text, o.tipo_cambio, v_f.moneda, v_f.tipo_cambio)), 0)
      INTO v_otras
    FROM public.factura_notas_credito o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.conceptos) = 'array' THEN o.conceptos ELSE '[]'::jsonb END) l
    WHERE o.factura_id = NEW.factura_id AND o.organization_id = NEW.organization_id
      AND o.id <> NEW.id AND o.deleted_at IS NULL AND o.estado <> 'Cancelada'
      AND lower(btrim(l->>'concepto_factura_id')) = r.cfid;
    IF r.base * v_fx + v_otras > (SELECT round(cf.cantidad * cf.precio_unitario, 2)
                                  FROM public.conceptos_factura cf WHERE cf.id = r.cfid::uuid) + 0.01 THEN
      RAISE EXCEPTION 'LC_NC_EXCEDE_CONCEPTO: la nota acredita más que el subtotal del concepto original.'
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public._nc_validar_linaje_conceptos() FROM PUBLIC, anon, authenticated;