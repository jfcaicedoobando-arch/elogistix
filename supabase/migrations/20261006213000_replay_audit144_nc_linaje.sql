-- Replay de drizzle/migrations/0007_audit144_nc_linaje_concepto.sql (ya aplicada en Lovable Cloud).
-- AUDIT-144: una nota de crédito resta en el embarque del concepto que acredita.
-- Renglones con `concepto_factura_id` válido restan su base sin IVA a ese
-- embarque; renglones sin linaje (manuales o NC antiguas) conservan el prorrateo
-- por factura. No se infiere linaje histórico ni se tocan XML/PDF.

CREATE OR REPLACE FUNCTION public._nc_factor_moneda_factura(
  p_nc_moneda text, p_nc_tc numeric, p_f_moneda text, p_f_tc numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN p_nc_moneda = p_f_moneda THEN 1::numeric
    WHEN p_f_moneda = 'MXN' AND p_nc_tc > 1 THEN p_nc_tc
    WHEN p_nc_moneda = 'MXN' AND p_f_tc > 1 THEN 1 / p_f_tc
    WHEN p_nc_tc > 1 AND p_f_tc > 1 THEN p_nc_tc / p_f_tc
    ELSE 0::numeric
  END;
$fn$;
REVOKE ALL ON FUNCTION public._nc_factor_moneda_factura(text, numeric, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._nc_factor_moneda_factura(text, numeric, text, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._venta_facturada_por_embarque(p_org uuid)
RETURNS TABLE(embarque_id uuid, moneda text, venta_doc numeric, venta_mxn numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
  WITH f0 AS (
    SELECT f.id, f.embarque_id AS emb_directo, f.moneda::text AS moneda, f.tipo_cambio,
           f.subtotal, f.total
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.organization_id = p_org
      AND f.estado IN ('Emitida'::estado_factura, 'Pagada'::estado_factura,
                       'Parcialmente pagada'::estado_factura, 'Vencida'::estado_factura)
  ),
  nc AS (
    SELECT nc.id, nc.factura_id, nc.monto, nc.conceptos,
           public._nc_factor_moneda_factura(nc.moneda::text, nc.tipo_cambio, f0.moneda, f0.tipo_cambio) AS fx
    FROM public.factura_notas_credito nc JOIN f0 ON f0.id = nc.factura_id
    WHERE nc.deleted_at IS NULL AND nc.estado IN ('Timbrada', 'Aplicada')
  ),
  lin AS (
    SELECT nc.id AS nc_id, nc.factura_id, nc.fx, cf.embarque_id AS emb,
           round(COALESCE((l->>'cantidad')::numeric, 1)
                 * COALESCE((l->>'precio_unitario')::numeric, 0), 2) AS base
    FROM nc
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(nc.conceptos) = 'array' THEN nc.conceptos ELSE '[]'::jsonb END) l
    LEFT JOIN public.conceptos_factura cf
      ON (l->>'concepto_factura_id') ~* '^[0-9a-f-]{36}$'
     AND cf.id = (l->>'concepto_factura_id')::uuid
     AND cf.factura_id = nc.factura_id
     AND cf.deleted_at IS NULL
     AND cf.embarque_id IS NOT NULL
  ),
  nc_split AS (
    SELECT nc.id, nc.factura_id,
           nc.fx * CASE WHEN COALESCE(SUM(lin.base), 0) > 0
                        THEN nc.monto * (SUM(lin.base) - COALESCE(SUM(lin.base) FILTER (WHERE lin.emb IS NOT NULL), 0)) / SUM(lin.base)
                        ELSE nc.monto END AS sin_linaje_doc
    FROM nc LEFT JOIN lin ON lin.nc_id = nc.id
    GROUP BY nc.id, nc.factura_id, nc.fx, nc.monto
  ),
  credito_directo AS (
    SELECT lin.factura_id, lin.emb AS embarque_id, SUM(lin.base * lin.fx) AS cred_doc
    FROM lin WHERE lin.emb IS NOT NULL
    GROUP BY 1, 2
  ),
  f AS (
    SELECT f0.*,
           f0.subtotal * (1 - LEAST(COALESCE((SELECT SUM(s.sin_linaje_doc) FROM nc_split s WHERE s.factura_id = f0.id), 0)
                                    / NULLIF(f0.total, 0), 1)) AS neto_doc
    FROM f0
  ),
  por_concepto AS (
    SELECT cf.factura_id, cf.embarque_id, SUM(COALESCE(cf.total, 0)) AS w
    FROM public.conceptos_factura cf JOIN f ON f.id = cf.factura_id
    WHERE cf.deleted_at IS NULL AND cf.embarque_id IS NOT NULL
    GROUP BY 1, 2
  ),
  por_vinculo AS (
    SELECT fe.factura_id, fe.embarque_id, 1::numeric AS w
    FROM public.factura_embarques fe JOIN f ON f.id = fe.factura_id
    WHERE fe.activa IS TRUE
      AND NOT EXISTS (SELECT 1 FROM por_concepto pc WHERE pc.factura_id = fe.factura_id)
  ),
  directo AS (
    SELECT f.id AS factura_id, f.emb_directo AS embarque_id, 1::numeric AS w
    FROM f
    WHERE f.emb_directo IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM por_concepto pc WHERE pc.factura_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM por_vinculo pv WHERE pv.factura_id = f.id)
  ),
  reparto AS (
    SELECT x.factura_id, x.embarque_id,
           x.w / NULLIF(SUM(x.w) OVER (PARTITION BY x.factura_id), 0) AS parte
    FROM (SELECT * FROM por_concepto UNION ALL SELECT * FROM por_vinculo
          UNION ALL SELECT * FROM directo) x
  ),
  neto AS (
    SELECT r.embarque_id, f.moneda, f.tipo_cambio,
           f.neto_doc * COALESCE(r.parte, 0) - COALESCE(cd.cred_doc, 0) AS doc
    FROM reparto r JOIN f ON f.id = r.factura_id
    LEFT JOIN credito_directo cd ON cd.factura_id = r.factura_id AND cd.embarque_id = r.embarque_id
  )
  SELECT n.embarque_id, n.moneda,
         SUM(n.doc) AS venta_doc,
         SUM(CASE WHEN n.moneda = 'MXN' THEN n.doc
                  WHEN COALESCE(n.tipo_cambio, 0) > 1 THEN n.doc * n.tipo_cambio END) AS venta_mxn
  FROM neto n
  GROUP BY n.embarque_id, n.moneda;
$fn$;
REVOKE ALL ON FUNCTION public._venta_facturada_por_embarque(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._venta_facturada_por_embarque(uuid) TO service_role;

-- Validación del linaje al guardar la nota (no toca el timbrado).
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
    SELECT l->>'concepto_factura_id' AS cfid,
           SUM(round(COALESCE((l->>'cantidad')::numeric, 1) * COALESCE((l->>'precio_unitario')::numeric, 0), 2)) AS base
    FROM jsonb_array_elements(NEW.conceptos) l
    WHERE NULLIF(l->>'concepto_factura_id', '') IS NOT NULL
    GROUP BY 1
  LOOP
    IF r.cfid !~* '^[0-9a-f-]{36}$' OR NOT EXISTS (
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
    WHERE o.factura_id = NEW.factura_id AND o.id <> NEW.id
      AND o.deleted_at IS NULL AND o.estado <> 'Cancelada'
      AND l->>'concepto_factura_id' = r.cfid;
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

DROP TRIGGER IF EXISTS trg_nc_validar_linaje_conceptos ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_validar_linaje_conceptos
  BEFORE INSERT OR UPDATE OF conceptos, factura_id, moneda, tipo_cambio ON public.factura_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public._nc_validar_linaje_conceptos();
