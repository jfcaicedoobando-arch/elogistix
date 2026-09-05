DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.dashboard_summary_datos()'::regprocedure);
  IF position('FROM embarques_base eb' in d) = 0 THEN
    RAISE NOTICE 'ya aplicado';
    RETURN;
  END IF;
  d := replace(d, 'FROM embarques_base eb', 'FROM activos eb');
  EXECUTE d;
END
$mig$;
REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;