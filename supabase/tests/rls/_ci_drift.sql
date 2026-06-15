-- ============================================================================
-- Drift fixes para CI: tablas / columnas que existen en prod pero nunca se
-- crearon vía migración (fueron añadidas manualmente en el dashboard).
--
-- Se ejecuta DESPUÉS de _ci_bootstrap.sql y ANTES del loop de migraciones.
-- Todas las sentencias son IDEMPOTENTES (IF NOT EXISTS) — corre sin daño en
-- entornos donde las columnas/tablas ya existen.
--
-- Cuando se descubra un nuevo drift, añadirlo aquí en lugar de tocar el
-- workflow. Cuando alguien escriba la migración real, se puede borrar el
-- bloque correspondiente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (resuelto) public.proformas.es_consolidada
-- La migración 20260424231755 ahora crea la columna con ADD COLUMN IF NOT EXISTS,
-- por lo que el drift fix ya no es necesario.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- public.tracking_intentos (tabla completa)
-- Migración 20260527061320 sólo redefine sus policies, asume tabla existente.
-- Stub con las columnas mínimas que las policies referencian + las que el
-- código de tracking insertará.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  embarque_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'unknown',
  accion text NOT NULL DEFAULT 'request',
  resultado text NOT NULL,
  http_status integer,
  mensaje text,
  detalle jsonb,
  request_type text,
  request_number text,
  scac text,
  tracking_request_id uuid,
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_intentos TO authenticated;
GRANT ALL ON public.tracking_intentos TO service_role;
ALTER TABLE public.tracking_intentos ENABLE ROW LEVEL SECURITY;
