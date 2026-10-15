\set ON_ERROR_STOP on
-- Intentionally fail closed until the full canonical INSERT/trigger paths and
-- two-tenant sentinels are reviewed. No defaults, roles or approvals are faked.
DO $$ BEGIN RAISE EXCEPTION 'FINANCIAL_CANONICAL_FIXTURE_REQUIRED' USING ERRCODE='55000'; END $$;
