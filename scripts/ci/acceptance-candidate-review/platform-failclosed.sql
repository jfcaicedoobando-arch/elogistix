-- Runtime-only platform boundary. These exact function signatures come from
-- supabase/tests/rls/_ci_bootstrap.sql. Existing replay stubs are replaced with
-- failures so a business test cannot obtain a false success from queue/network.
-- No public business function, policy, constraint or grant is changed here.
CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'ACCEPTANCE_CI_UNEXPECTED_NETWORK';
END $$;
CREATE OR REPLACE FUNCTION pgmq.send(queue_name text, msg jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'ACCEPTANCE_CI_UNEXPECTED_QUEUE';
END $$;
