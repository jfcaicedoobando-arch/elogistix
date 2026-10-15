-- Fixture for catalog ownership only; deliberately not historical core behavior.
CREATE FUNCTION public.seed_demo_organization_core() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'SYNTHETIC_OWNER_METADATA_ONLY_NO_SEED'; END $$;
