-- Fase 3 · Higiene de índices ------------------------------------------------
DROP INDEX IF EXISTS public.idx_bitacora_org_created_at;
DROP INDEX IF EXISTS public.idx_bitacora_entidad_id;
DROP INDEX IF EXISTS public.idx_conceptos_costo_embarque_id;
DROP INDEX IF EXISTS public.auditoria_revisiones_unq;

CREATE INDEX IF NOT EXISTS idx_documentos_embarque_org ON public.documentos_embarque (organization_id);
CREATE INDEX IF NOT EXISTS idx_eventos_embarque_org ON public.eventos_embarque (organization_id);
CREATE INDEX IF NOT EXISTS idx_notas_embarque_org ON public.notas_embarque (organization_id);
CREATE INDEX IF NOT EXISTS idx_contactos_cliente_org ON public.contactos_cliente (organization_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_costos_org ON public.cotizacion_costos (organization_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_comentarios_org ON public.auditoria_comentarios (organization_id);
CREATE INDEX IF NOT EXISTS idx_client_users_org ON public.client_users (organization_id);
CREATE INDEX IF NOT EXISTS idx_agente_users_org ON public.agente_users (organization_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_cuenta ON public.pagos_proveedor (cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_proveedor_cuenta ON public.anticipos_proveedor (cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_lote_cuenta ON public.pagos_proveedor_lote (cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_lote_proveedor ON public.pagos_proveedor_lote (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_efe_proveedor ON public.embarque_facturas_entrantes (proveedor_id);
CREATE INDEX IF NOT EXISTS idx_efe_proveedor_factura ON public.embarque_facturas_entrantes (proveedor_factura_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_embarque ON public.tracking_links (embarque_id);

-- Seguridad · vista con SECURITY DEFINER implícito -----------------------------
ALTER VIEW public.v_saldos_cuentas_bancarias SET (security_invoker = on);
