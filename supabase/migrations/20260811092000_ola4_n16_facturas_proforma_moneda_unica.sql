-- Ola 4 · N16: una proforma no puede generar dos facturas vivas en la misma
-- moneda. Antes sólo existía el índice simple idx_facturas_proforma_id
-- (20260424183008) y el guard de idempotencia corría DESPUÉS del INSERT:
-- el perdedor de una carrera dejaba facturas huérfanas en estado 'Emitida'.

-- Limpieza: soft-delete de facturas huérfanas de proforma (las que no son
-- factura_id ni factura_secundaria_id de su proforma), detectadas en la
-- pre-verificación de este PR.
UPDATE public.facturas f
   SET deleted_at = now()
  FROM public.proformas p
 WHERE f.proforma_id = p.id
   AND f.deleted_at IS NULL
   AND f.id IS DISTINCT FROM p.factura_id
   AND f.id IS DISTINCT FROM p.factura_secundaria_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_proforma_moneda_viva
  ON public.facturas (proforma_id, moneda)
  WHERE proforma_id IS NOT NULL AND deleted_at IS NULL;
