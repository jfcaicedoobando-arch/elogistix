-- Índice compuesto para acelerar el cálculo de facturas vencidas en sidebar_alert_counts
-- (filtra por organization_id + fecha_vencimiento < CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_facturas_org_vencimiento
  ON public.facturas (organization_id, fecha_vencimiento)
  WHERE estado <> 'Pagada';

-- Limpieza: idx_embarques_org_created e idx_embarques_org_created_at son idénticos.
-- Mantener el más explícito (_at) y eliminar el redundante.
DROP INDEX IF EXISTS public.idx_embarques_org_created;