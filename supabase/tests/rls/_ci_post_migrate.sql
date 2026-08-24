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
-- Re-cierre de funciones de plataforma (regla H6).
-- El GRANT masivo de arriba (necesario para el Postgres bare de CI) pisa los
-- REVOKE explícitos de las migraciones. Las funciones que sólo debe invocar
-- `service_role` (jobs de pg_cron y sus helpers) se vuelven a cerrar aquí para
-- que CI sea fiel a prod y las regresiones tipo FIX-45 detecten fugas reales.
-- ============================================================================
DO $$
DECLARE
  v_fn text;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public._reprocesar_comisiones_org(uuid)',
    'public.reprocesar_comisiones_job()',
    'public.verificar_sat_semanal_job()',
    -- B-3: rotación del lote semanal del barrido SAT (job de plataforma).
    'public.seleccionar_lote_sat_semanal(integer)',
    'public.notificar_uuid_cancelado_sat(uuid, jsonb)',
    -- FIX3 tanda 3: helpers financieros sin filtro org (ronda 2 P2) — sólo
    -- service_role / llamadas internas DEFINER.
    'public.venta_embarque_mxn_neta(uuid, numeric, numeric)',
    'public.nc_aplicadas_en_moneda_factura(uuid)',
    'public.comision_embarques_de_factura(uuid)',
    -- FIX3 tanda 3 (BUG-18 / O5.8): metadatos fiscales del buzón CxP sólo se
    -- escriben vía la edge (service_role).
    'public.adjuntar_xml_factura_entrante(uuid, text, text, text, text, text, text, date, numeric, text)',
    'public.adjuntar_xml_entrante_verificado(uuid, uuid, text, text, text, text, text, text, date, numeric, text)',
    -- FIX3 edge-hardening (v13.737.0): mutex de crons + bitácora de correos.
    -- Son helpers de plataforma sin ancla tenant; sólo los invocan las edge
    -- functions con service_role.
    'public.cron_try_lock(text, integer, text)',
    'public.cron_unlock(text)',
    'public.email_send_log_touch(text, text, text, text, text)'
  ]
  LOOP
    IF to_regprocedure(v_fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_fn);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIX2 B-1: re-cierre de las columnas internas de `public.embarques`.
-- El `GRANT SELECT ... ON ALL TABLES` de arriba reinstala el privilegio a
-- nivel tabla, lo que anula los REVOKE por columna de las migraciones
-- 20260824033159 / 20260824033552. Se repite aquí el mismo patrón
-- (revoke de tabla + grant columna por columna) para que CI sea fiel a prod.
-- ============================================================================
DO $$
DECLARE
  v_cols text;
  v_internas text[] := ARRAY['cerrado_snapshot','tarifa_delta_jsonb','reabierto_motivo','created_by_email'];
BEGIN
  IF to_regclass('public.embarques') IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'embarques'
    AND NOT (column_name = ANY (v_internas));

  EXECUTE 'REVOKE SELECT ON public.embarques FROM authenticated';
  EXECUTE 'REVOKE SELECT ON public.embarques FROM anon';
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO authenticated', v_cols);
  EXECUTE format('GRANT SELECT (%s) ON public.embarques TO anon', v_cols);
END $$;


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

