-- Run before _ci_post_migrate.sql: its broad harness grants must not hide ACL drift.
BEGIN;
DO $test$
BEGIN
  IF NOT has_table_privilege('authenticated','public.cotizacion_handovers','SELECT')
     OR has_table_privilege('authenticated','public.cotizacion_handovers','INSERT')
     OR has_table_privilege('authenticated','public.cotizacion_handovers','UPDATE')
     OR has_table_privilege('authenticated','public.cotizacion_handovers','DELETE') THEN
    RAISE EXCEPTION 'handover authenticated grants differ from immutable 0029';
  END IF;
  IF has_table_privilege('anon','public.cotizacion_handovers','SELECT')
     OR has_table_privilege('anon','public.cotizacion_handovers','INSERT')
     OR has_table_privilege('anon','public.cotizacion_handovers','UPDATE')
     OR has_table_privilege('anon','public.cotizacion_handovers','DELETE') THEN
    RAISE EXCEPTION 'handover anon gained table privileges';
  END IF;
  IF NOT has_table_privilege('service_role','public.cotizacion_handovers','SELECT')
     OR NOT has_table_privilege('service_role','public.cotizacion_handovers','INSERT')
     OR NOT has_table_privilege('service_role','public.cotizacion_handovers','UPDATE')
     OR NOT has_table_privilege('service_role','public.cotizacion_handovers','DELETE') THEN
    RAISE EXCEPTION 'handover service role grants changed';
  END IF;
END $test$;
ROLLBACK;
