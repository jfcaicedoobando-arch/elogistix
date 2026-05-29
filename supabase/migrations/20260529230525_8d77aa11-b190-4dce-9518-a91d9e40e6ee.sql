CREATE OR REPLACE FUNCTION public.portal_update_contacto(
  _nombre text,
  _telefono text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.has_role(_uid, 'cliente'::app_role) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _nombre IS NULL OR length(btrim(_nombre)) = 0 OR length(_nombre) > 100 THEN
    RAISE EXCEPTION 'Nombre inválido';
  END IF;

  IF _telefono IS NOT NULL AND length(_telefono) > 30 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  UPDATE public.clientes
     SET contacto = btrim(_nombre),
         telefono = COALESCE(btrim(_telefono), ''),
         updated_at = now()
   WHERE id IN (SELECT public.current_user_client_ids())
     AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_update_contacto(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_update_contacto(text, text) TO authenticated;