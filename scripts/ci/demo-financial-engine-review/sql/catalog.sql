\set ON_ERROR_STOP on
-- No reduced catalog may stand in for the complete canonical financial catalog.
DO $$ BEGIN RAISE EXCEPTION 'FINANCIAL_CANONICAL_CLOSURE_REQUIRED: see catalog-status.json' USING ERRCODE='55000'; END $$;
