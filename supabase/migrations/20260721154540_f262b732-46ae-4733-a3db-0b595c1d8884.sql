-- Retención: purga eventos webhook > 60 días
CREATE OR REPLACE FUNCTION public.purgar_facturapi_webhook_eventos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.facturapi_webhook_eventos
    WHERE received_at < now() - interval '60 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purgar_facturapi_webhook_eventos() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purgar_facturapi_webhook_eventos() FROM anon;
REVOKE EXECUTE ON FUNCTION public.purgar_facturapi_webhook_eventos() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_facturapi_webhook_eventos() TO service_role;

-- Endurecer la tabla: nadie que no sea service_role la ve
REVOKE ALL ON public.facturapi_webhook_eventos FROM anon;
REVOKE ALL ON public.facturapi_webhook_eventos FROM authenticated;
REVOKE ALL ON public.facturapi_webhook_eventos FROM PUBLIC;