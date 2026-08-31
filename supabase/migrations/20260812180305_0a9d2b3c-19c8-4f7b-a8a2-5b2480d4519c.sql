-- FIX BL-08 (auditoría BL/BD) — OPCIONAL / defensa en profundidad.
-- El hallazgo original (funciones de email_infra SECURITY DEFINER sin
-- search_path) YA fue corregido por 20260618205406 y 20260710021502
-- (ALTER FUNCTION ... SET search_path = public, pgmq). Esta migración solo
-- re-asevera el estado de forma idempotente contra drift entre ambientes.
DO $guard$ BEGIN
  IF to_regprocedure('public.enqueue_email(text, jsonb)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.read_email_batch(text, integer, integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.delete_email(text, bigint)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq';
  END IF;
END $guard$;
DO $guard$ BEGIN
  IF to_regprocedure('public.move_to_dlq(text, text, bigint, jsonb)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq';
  END IF;
END $guard$;

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
