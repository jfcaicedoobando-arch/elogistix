-- Session-local observation wrapper. It neither replaces nor pauses the RPC.
-- EXCEPTION creates a subtransaction. On error it rolls back the called RPC's
-- effects exactly within that capture scope; no public function/ACL is changed.
CREATE FUNCTION pg_temp.h14_race_rpc(p_embarque uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $h14_capture$
DECLARE
  actor jsonb;
  state text;
  message text;
  hint text;
  detail text;
  context text;
BEGIN
  actor := jsonb_build_object(
    'current_user',current_user,'session_user',session_user,'auth_uid',auth.uid(),
    'org',public.current_user_org_id(),
    'admin',public.has_role(auth.uid(),'admin'::public.app_role),
    'operador',public.has_role(auth.uid(),'operador'::public.app_role),
    'super_admin',public.has_role(auth.uid(),'super_admin'::public.app_role),
    'claims',current_setting('request.jwt.claims')::jsonb,
    'isolation',current_setting('transaction_isolation'));
  PERFORM public.eliminar_embarque_completo(p_embarque);
  RETURN jsonb_build_object('error',false,'sqlstate','00000','actor_at_rpc',actor,
    'message',NULL,'hint',NULL,'detail',NULL,'context',NULL);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,message=MESSAGE_TEXT,
    hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,context=PG_EXCEPTION_CONTEXT;
  RETURN jsonb_build_object('error',true,'sqlstate',state,'actor_at_rpc',actor,
    'message',message,'hint',hint,'detail',detail,'context',context);
END $h14_capture$;

CREATE FUNCTION pg_temp.h14_race_statement(p_statement text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $h14_operation$
DECLARE actor jsonb; state text; message text; hint text; detail text; context text;
BEGIN
 actor:=jsonb_build_object('current_user',current_user,'session_user',session_user,'auth_uid',auth.uid(),
  'org',public.current_user_org_id(),'admin',public.has_role(auth.uid(),'admin'::public.app_role),
  'operador',public.has_role(auth.uid(),'operador'::public.app_role),
  'super_admin',public.has_role(auth.uid(),'super_admin'::public.app_role),
  'claims',current_setting('request.jwt.claims')::jsonb,'isolation',current_setting('transaction_isolation'));
 EXECUTE p_statement;
 RETURN jsonb_build_object('error',false,'sqlstate','00000','actor_at_rpc',actor,'message',NULL,'hint',NULL,'detail',NULL,'context',NULL);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,message=MESSAGE_TEXT,hint=PG_EXCEPTION_HINT,detail=PG_EXCEPTION_DETAIL,context=PG_EXCEPTION_CONTEXT;
 RETURN jsonb_build_object('error',true,'sqlstate',state,'actor_at_rpc',actor,'message',message,'hint',hint,'detail',detail,'context',context);
END $h14_operation$;
