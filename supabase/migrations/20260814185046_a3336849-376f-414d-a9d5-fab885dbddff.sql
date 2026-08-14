REVOKE ALL ON FUNCTION public.list_trash(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trash(text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_trash_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trash_counts() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.restore_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_record(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.purge_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_record(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_idempotency_log(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_idempotency_log(integer, integer) TO authenticated, service_role;