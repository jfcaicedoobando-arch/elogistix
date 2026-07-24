
-- v13.312.23 — Índices para reducir CPU en queries frecuentes
CREATE INDEX IF NOT EXISTS idx_auditoria_revisiones_created_at
  ON public.auditoria_revisiones (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bitacora_accion_created_at
  ON public.bitacora_actividad (accion, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conceptos_venta_embarque_activo
  ON public.conceptos_venta (embarque_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_org_estado_vencimiento
  ON public.facturas (organization_id, estado, fecha_vencimiento)
  WHERE deleted_at IS NULL;
