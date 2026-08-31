-- Fase 3 (auditoría) — endurecimiento de superficie anónima, performance RLS e índices.
-- NO se revoca EXECUTE a anon sobre has_role/current_agente_id/current_agente_org:
-- existen políticas con roles {public} que las invocan (revocar => 42501 en sesiones
-- anónimas/expiradas); están en la whitelist FIX-45 y devuelven NULL/false sin uid.
-- NO se dropean las tablas _backup_merge_*_20260602 (el dueño pidió conservarlas).
-- Los 4 buckets privados ya existen.

REVOKE USAGE ON SCHEMA extensions FROM anon;

DO $guard$ BEGIN
  IF to_regprocedure('public.enqueue_email(text, jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM authenticated, anon, PUBLIC';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.read_email_batch(text, integer, integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM authenticated, anon, PUBLIC';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.delete_email(text, bigint)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM authenticated, anon, PUBLIC';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.move_to_dlq(text, text, bigint, jsonb)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM authenticated, anon, PUBLIC';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.enqueue_email(text, jsonb)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.read_email_batch(text, integer, integer)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.delete_email(text, bigint)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.move_to_dlq(text, text, bigint, jsonb)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role';
  END IF;
END $guard$;

DROP POLICY IF EXISTS "nav_events insert own org" ON public.nav_events;
CREATE POLICY "nav_events insert own org" ON public.nav_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_user_org_id()
    AND user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Super admin maneja su tenant activo" ON public.super_admin_org_activa;
CREATE POLICY "Super admin maneja su tenant activo" ON public.super_admin_org_activa
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND has_role((SELECT auth.uid()), 'super_admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_lote_org
  ON public.pagos_proveedor_lote (organization_id);
CREATE INDEX IF NOT EXISTS idx_cotizacion_costos_historico_org
  ON public.cotizacion_costos_historico (organization_id);