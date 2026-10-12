-- Empty local ledger with observed 2026-10-12 metadata, never remote rows.
-- Source: ledger-metadata-live.json. Live platform event triggers are documented
-- there but not installed in vanilla PostgreSQL; tests inject their own hooks.
CREATE SCHEMA supabase_migrations AUTHORIZATION postgres;
CREATE TABLE supabase_migrations.schema_migrations (
  version text NOT NULL,
  statements text[],
  name text,
  created_by text,
  idempotency_key text,
  rollback text[],
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (version),
  CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key)
);
DO $fixture$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='supabase_migrations' AND c.relname='schema_migrations'
      AND c.relkind='r' AND c.relowner='postgres'::regrole AND n.nspowner='postgres'::regrole
      AND c.relacl IS NULL AND n.nspacl IS NULL AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
  ) OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='supabase_migrations.schema_migrations'::regclass)
    OR EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class='supabase_migrations.schema_migrations'::regclass)
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='supabase_migrations.schema_migrations'::regclass) THEN
    RAISE EXCEPTION 'Ledger fixture does not match observed security metadata';
  END IF;
END;
$fixture$;
