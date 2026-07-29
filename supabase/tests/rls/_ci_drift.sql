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
-- public.proformas.es_consolidada
-- Añadida manualmente en prod; la migración 20260424231755 hace UPDATE sobre
-- esta columna pero la tabla se DROP+CREATE en 20260424164231 sin incluirla.
-- Usamos un EVENT TRIGGER que añade la columna automáticamente cada vez que
-- se cree (o recree) la tabla `public.proformas` durante el loop de migraciones.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._ci_ensure_proformas_es_consolidada()
RETURNS event_trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT objid::regclass::text AS rel
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
  LOOP
    IF r.rel = 'proformas' OR r.rel = 'public.proformas' THEN
      EXECUTE 'ALTER TABLE public.proformas
               ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false';
      -- 13.56.11: drift adicional descubierto al correr suites RLS local.
      -- Migración 20260617052908 hace COALESCE(p.estado_aprobacion, '') sin
      -- que ninguna migración previa la cree (añadida manualmente en prod).
      EXECUTE 'ALTER TABLE public.proformas
               ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT ''Aprobada''';
    END IF;
  END LOOP;
END;
$fn$;

DROP EVENT TRIGGER IF EXISTS _ci_proformas_es_consolidada_trg;
CREATE EVENT TRIGGER _ci_proformas_es_consolidada_trg
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public._ci_ensure_proformas_es_consolidada();

-- Por si la tabla ya existe en este momento (no debería en CI, sí en prod):
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'proformas') THEN
    EXECUTE 'ALTER TABLE public.proformas
             ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.proformas
             ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT ''Aprobada''';
  END IF;
END $$;

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

-- ---------------------------------------------------------------------------
-- public.tracking_externo (tabla completa)
-- Añadida manualmente en prod; migración 20260602213410 (merge embarques) hace
-- INSERT ... FROM public.tracking_externo y falla si la tabla no existe.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_externo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'unknown',
  tracking_request_id text,
  shipment_id text,
  request_number text NOT NULL DEFAULT '',
  request_type text NOT NULL DEFAULT 'unknown',
  scac text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  failed_reason text,
  last_event_at timestamptz,
  last_synced_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_externo TO authenticated;
GRANT ALL ON public.tracking_externo TO service_role;
ALTER TABLE public.tracking_externo ENABLE ROW LEVEL SECURITY;

-- Stub policy para que el verificador RLS (_ci_verify_rls.sql) no falle.
-- Las policies reales se instalan en _ci_post_migrate.sql (después de que
-- las migraciones crean has_role()/current_user_org_id()).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tracking_externo'
  ) THEN
    EXECUTE 'CREATE POLICY "_ci_stub_deny_all" ON public.tracking_externo FOR ALL TO authenticated USING (false) WITH CHECK (false)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- publication supabase_realtime → movida a `_ci_bootstrap.sql` (v13.322.8):
-- no es drift del proyecto sino diferencia entre Postgres vanilla y Supabase.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- public.embarque_consecutivo_seq
-- Secuencia creada manualmente en prod pre-historial. Migraciones antiguas
-- solo la usan vía nextval() dentro de cuerpos de función (lazy). La migración
-- 20260713165742 la referencia en un DO $$ ... SELECT last_value FROM ... $$
-- que se ejecuta al momento del replay → error en CI limpio. Guard idempotente.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.embarque_consecutivo_seq;
