DO $$
DECLARE
  t text;
  pol_sql text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      '_backup_backfill_proformas_20260706',
      '_backup_conceptos_venta_elimp00195_20260706',
      '_backup_gap_externo_proformas_20260706',
      '_backup_gap_externo_proformas_20260706_lote2',
      '_backup_merge_client_users_20260706',
      '_backup_merge_clientes_20260706',
      '_backup_merge_embarques_20260602',
      '_backup_merge_fk_remap_20260602'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.%I;', policyname, t), ' ')
        INTO pol_sql
        FROM pg_policies WHERE schemaname='public' AND tablename=t;
      IF pol_sql IS NOT NULL THEN EXECUTE pol_sql; END IF;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

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