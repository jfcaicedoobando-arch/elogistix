GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO supabase_storage_admin;