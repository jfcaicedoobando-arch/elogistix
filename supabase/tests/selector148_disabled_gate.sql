BEGIN;
DO $$
DECLARE granted boolean; rejected boolean := false;
BEGIN
  SELECT bool_or(has_function_privilege(r,'public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)','EXECUTE')) INTO granted FROM unnest(ARRAY['authenticated','anon','service_role']) r;
  IF granted THEN RAISE EXCEPTION 'disabled endpoint exposed through effective ACL'; END IF;
  BEGIN
    PERFORM public.seguro_facturas_elegibles(NULL,100,'MXN');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'LC_SELECTOR148_NO_DISPONIBLE' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'hard disabled gate failed for owner'; END IF;
  RAISE NOTICE 'PASS: disabled ACL and literal hard gate';
END $$;
ROLLBACK;
