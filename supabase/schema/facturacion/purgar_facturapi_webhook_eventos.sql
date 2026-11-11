CREATE OR REPLACE FUNCTION public.purgar_facturapi_webhook_eventos() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_eliminados integer;
BEGIN
  DELETE FROM public.facturapi_webhook_eventos
   WHERE received_at < now() - interval '60 days'
     AND procesamiento_estado IN ('legado', 'procesado', 'ignorado', 'agotado');
  GET DIAGNOSTICS v_eliminados = ROW_COUNT;
  RETURN v_eliminados;
END;
$fn$;

REVOKE ALL ON FUNCTION public.purgar_facturapi_webhook_eventos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_facturapi_webhook_eventos() TO service_role;
