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