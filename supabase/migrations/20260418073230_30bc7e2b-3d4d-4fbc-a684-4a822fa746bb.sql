-- Habilitar extensión pg_trgm para búsquedas de texto similar
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices trigram para búsqueda global
CREATE INDEX IF NOT EXISTS idx_embarques_expediente_trgm ON public.embarques USING gin (expediente gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_bl_master_trgm ON public.embarques USING gin (bl_master gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_contenedor_trgm ON public.embarques USING gin (contenedor gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_cliente_nombre_trgm ON public.embarques USING gin (cliente_nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_descripcion_trgm ON public.embarques USING gin (descripcion_mercancia gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm ON public.clientes USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_rfc_trgm ON public.clientes USING gin (rfc gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre_trgm ON public.proveedores USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_proveedores_rfc_trgm ON public.proveedores USING gin (rfc gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio_trgm ON public.cotizaciones USING gin (folio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_trgm ON public.cotizaciones USING gin (cliente_nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_prospecto_trgm ON public.cotizaciones USING gin (prospecto_empresa gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_facturas_numero_trgm ON public.facturas USING gin (numero gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_trgm ON public.facturas USING gin (cliente_nombre gin_trgm_ops);

-- Índices auxiliares para listas y filtros
CREATE INDEX IF NOT EXISTS idx_embarques_org_eta ON public.embarques (organization_id, eta);
CREATE INDEX IF NOT EXISTS idx_embarques_org_created ON public.embarques (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embarques_cliente_id ON public.embarques (cliente_id);
CREATE INDEX IF NOT EXISTS idx_embarques_operador ON public.embarques (operador);
CREATE INDEX IF NOT EXISTS idx_embarques_estado ON public.embarques (estado);
CREATE INDEX IF NOT EXISTS idx_embarques_modo ON public.embarques (modo);

CREATE INDEX IF NOT EXISTS idx_conceptos_costo_embarque ON public.conceptos_costo (embarque_id);
CREATE INDEX IF NOT EXISTS idx_conceptos_venta_embarque ON public.conceptos_venta (embarque_id);
CREATE INDEX IF NOT EXISTS idx_documentos_embarque_eid ON public.documentos_embarque (embarque_id);
CREATE INDEX IF NOT EXISTS idx_notas_embarque_eid ON public.notas_embarque (embarque_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_embarque ON public.facturas (embarque_id);
CREATE INDEX IF NOT EXISTS idx_facturas_org_estado ON public.facturas (organization_id, estado);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_client_users_user ON public.client_users (user_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_org_created ON public.bitacora_actividad (organization_id, created_at DESC);