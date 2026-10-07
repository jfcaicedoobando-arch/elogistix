-- Drizzle 0010 preserves charges through soft deletion; CI must not invent
-- authenticated DELETE access when restoring its generic Data API grants.
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['costeo_cargos_fob_agente', 'costeo_cargos_locales_naviera'] LOOP
    IF to_regclass('public.' || tabla) IS NULL THEN
      RAISE EXCEPTION 'Missing tarifario table: %', tabla;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.' || tabla, 'SELECT')
       OR NOT has_table_privilege('authenticated', 'public.' || tabla, 'INSERT')
       OR NOT has_table_privilege('authenticated', 'public.' || tabla, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || tabla, 'DELETE') THEN
      RAISE EXCEPTION 'Tarifario ACL differs from Drizzle 0010: %', tabla;
    END IF;
    IF has_table_privilege('anon', 'public.' || tabla, 'SELECT')
       OR has_table_privilege('anon', 'public.' || tabla, 'INSERT')
       OR has_table_privilege('anon', 'public.' || tabla, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || tabla, 'DELETE') THEN
      RAISE EXCEPTION 'Unexpected anonymous tarifario access: %', tabla;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.crm_aplicar_tarifa_tarifario(uuid,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.crm_aplicar_tarifa_tarifario(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Tarifario RPC ACL differs from Drizzle 0010';
  END IF;
END $$;
