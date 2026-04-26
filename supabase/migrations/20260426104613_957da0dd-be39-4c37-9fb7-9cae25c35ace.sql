-- Asegurar extension pg_trgm (ya parece estar instalada según show_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN trigram para búsquedas ilike en embarques
CREATE INDEX IF NOT EXISTS idx_embarques_expediente_trgm ON public.embarques USING gin (expediente gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_cliente_nombre_trgm ON public.embarques USING gin (cliente_nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_bl_master_trgm ON public.embarques USING gin (bl_master gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_embarques_descripcion_trgm ON public.embarques USING gin (descripcion_mercancia gin_trgm_ops);

-- Índices que apoyan filtros y orden frecuentes en /embarques
CREATE INDEX IF NOT EXISTS idx_embarques_org_created_at ON public.embarques (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_embarques_cliente_id ON public.embarques (cliente_id);
CREATE INDEX IF NOT EXISTS idx_embarques_operador ON public.embarques (operador);

-- Índices para búsquedas en cotizaciones (también usa ilike por folio/cliente)
CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio_trgm ON public.cotizaciones USING gin (folio gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_nombre_trgm ON public.cotizaciones USING gin (cliente_nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_descripcion_trgm ON public.cotizaciones USING gin (descripcion_mercancia gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_org_created_at ON public.cotizaciones (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON public.cotizaciones (estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_id ON public.cotizaciones (cliente_id);