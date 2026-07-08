-- 1) RPC de auditoría
CREATE OR REPLACE FUNCTION public.auditoria_pfc_huerfanos()
RETURNS TABLE(
  pfc_id uuid,
  proveedor_factura_id uuid,
  folio_interno text,
  embarque_id uuid,
  expediente text,
  descripcion text,
  monto numeric,
  concepto_costo_id_huerfano uuid,
  organization_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pfc.id, pf.id, pf.folio_interno, pf.embarque_id, e.expediente,
         pfc.descripcion, pfc.monto, pfc.concepto_costo_id, pf.organization_id
  FROM public.proveedor_facturas_conceptos pfc
  JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  LEFT JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
  WHERE pfc.concepto_costo_id IS NOT NULL
    AND cc.id IS NULL
    AND pf.deleted_at IS NULL
  ORDER BY pf.folio_interno, pfc.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.auditoria_pfc_huerfanos() TO authenticated;

-- 2) Backfill
CREATE OR REPLACE FUNCTION public._backfill_pfc_huerfanos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  SET LOCAL session_replication_role = 'replica';

  WITH huerfanos AS (
    SELECT pfc.id AS pfc_id,
           pfc.descripcion,
           ROUND(pfc.monto::numeric, 2) AS monto_r,
           pf.embarque_id,
           pf.proveedor_id,
           pf.proveedor_nombre,
           ROW_NUMBER() OVER (
             PARTITION BY pf.embarque_id, COALESCE(pf.proveedor_id::text, pf.proveedor_nombre), pfc.descripcion, ROUND(pfc.monto::numeric, 2)
             ORDER BY pfc.created_at, pfc.id
           ) AS rn
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    LEFT JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
    WHERE pfc.concepto_costo_id IS NOT NULL
      AND cc.id IS NULL
      AND pf.deleted_at IS NULL
      AND pf.embarque_id IS NOT NULL
  ),
  candidatos AS (
    SELECT cc.id AS cc_id,
           cc.embarque_id,
           cc.proveedor_id,
           cc.proveedor_nombre,
           cc.concepto,
           ROUND(cc.monto::numeric, 2) AS monto_r,
           ROW_NUMBER() OVER (
             PARTITION BY cc.embarque_id, COALESCE(cc.proveedor_id::text, cc.proveedor_nombre), cc.concepto, ROUND(cc.monto::numeric, 2)
             ORDER BY cc.created_at, cc.id
           ) AS rn
    FROM public.conceptos_costo cc
    WHERE cc.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pfc2
        JOIN public.conceptos_costo cc2 ON cc2.id = pfc2.concepto_costo_id
        WHERE pfc2.concepto_costo_id = cc.id
      )
  ),
  pares AS (
    SELECT h.pfc_id, c.cc_id
    FROM huerfanos h
    JOIN candidatos c
      ON c.embarque_id = h.embarque_id
     AND COALESCE(c.proveedor_id::text, c.proveedor_nombre) = COALESCE(h.proveedor_id::text, h.proveedor_nombre)
     AND c.concepto = h.descripcion
     AND c.monto_r = h.monto_r
     AND c.rn = h.rn
  )
  UPDATE public.proveedor_facturas_conceptos pfc
  SET concepto_costo_id = p.cc_id
  FROM pares p
  WHERE pfc.id = p.pfc_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, accion, modulo, entidad_id, entidad_nombre, detalles
  )
  SELECT pf.organization_id,
         'pfc.huerfano_no_reconciliado',
         'proveedor_facturas_conceptos',
         pfc.id,
         COALESCE(pf.folio_interno, 'sin folio'),
         jsonb_build_object(
           'proveedor_factura_id', pf.id,
           'folio_interno', pf.folio_interno,
           'embarque_id', pf.embarque_id,
           'descripcion', pfc.descripcion,
           'monto', pfc.monto,
           'concepto_costo_id_huerfano', pfc.concepto_costo_id
         )
  FROM public.proveedor_facturas_conceptos pfc
  JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
  LEFT JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
  WHERE pfc.concepto_costo_id IS NOT NULL
    AND cc.id IS NULL
    AND pf.deleted_at IS NULL;

  UPDATE public.proveedor_facturas_conceptos pfc
  SET concepto_costo_id = NULL
  WHERE pfc.concepto_costo_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.conceptos_costo cc WHERE cc.id = pfc.concepto_costo_id);
END;
$fn$;

SELECT public._backfill_pfc_huerfanos();
DROP FUNCTION public._backfill_pfc_huerfanos();

-- 3) FK ON DELETE SET NULL
ALTER TABLE public.proveedor_facturas_conceptos
  ADD CONSTRAINT proveedor_facturas_conceptos_concepto_costo_id_fkey
  FOREIGN KEY (concepto_costo_id) REFERENCES public.conceptos_costo(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pfc_concepto_costo_id
  ON public.proveedor_facturas_conceptos(concepto_costo_id);
