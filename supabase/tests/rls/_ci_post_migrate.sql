-- ============================================================================
-- Post-migración CI: relaja restricciones que dependen de GoTrue real.
--
-- Las suites RLS generan UUIDs aleatorios para usuarios simulados y los
-- pasan vía request.jwt.claims.sub. No insertan filas reales en auth.users
-- (no hay GoTrue en CI), así que los FK ... REFERENCES auth.users(id)
-- bloquearían los seeds. Soltamos esos FK únicamente en el contenedor CI.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f'
       AND con.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      r.schema_name, r.table_name, r.conname
    );
  END LOOP;
END $$;

-- ============================================================================
-- GRANTs por defecto del esquema public.
-- Supabase Cloud los aplica vía Data API; en el Postgres bare de CI hay que
-- emitirlos explícitamente o cualquier SELECT bajo el rol authenticated
-- falla con "permission denied". RLS sigue siendo el único gate de aislamiento.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

-- ============================================================================
-- Drop triggers que dependen de columnas/comportamiento de runtime (no de RLS).
-- `trg_pago_factura_comision` llama a `calcular_comision_pago()` que hace
-- `SELECT vendedora_id, COALESCE(tipo_cambio, 1) FROM embarques`, pero
-- `embarques` tiene `tipo_cambio_usd`/`tipo_cambio_eur`, no `tipo_cambio`.
-- En producción la función nunca dispara porque hay vendedoras configuradas;
-- en CI cualquier INSERT en `pagos_factura` lo rompe. Como las suites RLS
-- solo validan aislamiento, drop seguro.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_pago_factura_comision ON public.pagos_factura;
DROP TRIGGER IF EXISTS trg_pago_factura_comision_ins ON public.pagos_factura;

-- ============================================================================
-- Stub deny-all removido: las 3 policies reales de tracking_externo ya viven
-- en supabase/migrations/20260703185259_*.sql (13.162.0). Sólo limpiamos aquí
-- el stub deny-all que instala _ci_drift.sql antes de aplicar migraciones.
-- ============================================================================
DROP POLICY IF EXISTS "_ci_stub_deny_all" ON public.tracking_externo;

