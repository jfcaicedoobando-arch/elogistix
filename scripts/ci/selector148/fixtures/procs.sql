SELECT jsonb_pretty(jsonb_agg(to_jsonb(p) ORDER BY p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
