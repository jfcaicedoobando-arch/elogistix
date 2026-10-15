CREATE SCHEMA demo_flow_writer;
REVOKE ALL ON SCHEMA demo_flow_writer FROM PUBLIC;
CREATE FUNCTION demo_flow_writer.assert_active_organization() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$ BEGIN
  PERFORM 1 FROM public.organizations WHERE id='00000000-0000-4000-8000-000000000001' AND activo IS TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_ORGANIZATION_INACTIVE' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION demo_flow_writer.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'DEMO_IMMUTABLE_PROVENANCE' USING ERRCODE='42501'; END $$;
CREATE FUNCTION demo_flow_writer.sha256(p_value jsonb) RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER
SET search_path=pg_catalog AS $$ SELECT encode(sha256(convert_to(p_value::text,'UTF8')),'hex') $$;
