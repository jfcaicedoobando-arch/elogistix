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
-- FIX-45-HARDENING: ya NO se otorga todo a `anon`. El grant masivo a anon
-- neutralizaba fix45_anon_execute_whitelist.sql (200+ funciones SECURITY
-- DEFINER "expuestas" artificialmente) y hacía a CI infiel a prod, donde
-- solo llegan a anon los GRANTs explícitos de las migraciones (p.ej.
-- demo_leads). USAGE en el schema se conserva.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- ============================================================================
-- Triggers de comisiones.
--
-- Antes se dropeaba `trg_pago_factura_comision_ins` aquí para evitar un bug
-- legacy de `calcular_comision_pago(uuid)` que leía `embarques.tipo_cambio`.
-- Ese bug ya fue corregido por la migración 20260616231916 para usar
-- `tipo_cambio_usd`, y `schema-invariants.sql` ahora exige que el trigger
-- exista. No lo removemos en CI: si vuelve a romper, queremos detectarlo.
-- ============================================================================

-- ============================================================================
-- Stub deny-all removido: las 3 policies reales de tracking_externo ya viven
-- en supabase/migrations/20260703185259_*.sql (13.162.0). Sólo limpiamos aquí
-- el stub deny-all que instala _ci_drift.sql antes de aplicar migraciones.
-- ============================================================================
DROP POLICY IF EXISTS "_ci_stub_deny_all" ON public.tracking_externo;

