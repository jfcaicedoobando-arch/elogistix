-- ============================================================================
-- Catálogo ÚNICO de columnas internas de `public.embarques` (FIX2 B-1).
--
-- Estas columnas NO deben tener SELECT para `authenticated`/`anon`: RLS filtra
-- filas, no columnas, y un usuario de portal con acceso a su propia fila podía
-- leer el PnL con `select=*`. El staff las consume por
-- `public.embarques_interno_v`.
--
-- ÚNICA fuente de verdad. Se consume con `\ir` desde:
--   · supabase/tests/fix2_embarques_interno_y_nc.sql
--   · supabase/tests/embarques_listado_sin_select_estrella.sql
--   · supabase/tests/rls/_ci_post_migrate.sql   (re-cierre en CI)
--
-- Al añadir una columna interna nueva en una migración (REVOKE de tabla +
-- GRANT por columna), agrégala AQUÍ en la misma PR: los tres consumidores la
-- empiezan a exigir automáticamente y ninguno queda ciego.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.columnas_internas_embarques() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'cerrado_snapshot',    -- snapshot financiero del cierre (PnL)
    'tarifa_delta_jsonb',  -- desviación de tarifa vs costo real
    'reabierto_motivo',    -- nota interna de reapertura
    'created_by_email'     -- PII del staff que dio de alta
  ]::text[];
$$;
