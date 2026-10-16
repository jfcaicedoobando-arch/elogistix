CREATE OR REPLACE FUNCTION public._crm_empresa_proteger_creador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  -- Historical migrations and trusted backend producers may attribute records
  -- on behalf of another user. An end-user RPC keeps its authenticated JWT.
  IF auth.role() = 'service_role'
    OR (v_uid IS NULL AND coalesce(auth.role(), '') <> 'authenticated') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
  END IF;
  BEGIN
    PERFORM public._assert_writer(CASE WHEN TG_OP = 'INSERT' THEN NEW.organization_id ELSE OLD.organization_id END);
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_CREADOR_PROTEGIDO' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_proteger_creador() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_proteger_creador() TO service_role;
