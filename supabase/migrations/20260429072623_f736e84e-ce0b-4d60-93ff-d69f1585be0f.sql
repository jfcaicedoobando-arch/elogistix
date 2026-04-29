ALTER TABLE public.auditoria_revisiones
  ADD CONSTRAINT auditoria_revisiones_unique_finding
  UNIQUE (organization_id, embarque_id, regla, detalle_hash);