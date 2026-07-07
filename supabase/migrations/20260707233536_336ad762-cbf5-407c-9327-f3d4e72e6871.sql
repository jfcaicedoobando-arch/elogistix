UPDATE public.proformas
SET estado_revision = 'aprobada',
    updated_at = now()
WHERE estado_cliente = 'aceptada'
  AND estado_proforma = 'facturada'
  AND estado_revision = 'pendiente'
  AND deleted_at IS NULL;