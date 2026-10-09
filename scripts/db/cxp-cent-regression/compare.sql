\set ON_ERROR_STOP on
\ir harness.sql
SELECT set_config('qa.phase','baseline',false);
\ir fixtures/recalc-live.sql
;
\ir fixtures/cierre-live.sql
;
\ir matrix.sql
SELECT set_config('qa.phase','candidate',false);
\i :candidate_recalc
\i :candidate_cierre
\ir matrix.sql
SELECT phase,COUNT(*) AS assertions,COUNT(*) FILTER (WHERE passed) AS passed,COUNT(*) FILTER (WHERE NOT passed) AS failed FROM qa_results GROUP BY phase ORDER BY phase;
SELECT phase,label,actual,expected FROM qa_results WHERE NOT passed ORDER BY phase,label;
COPY (SELECT * FROM qa_results ORDER BY phase,label) TO :'results_path' CSV HEADER;
DO $$BEGIN IF EXISTS(SELECT 1 FROM qa_results WHERE phase='candidate' AND NOT passed) THEN RAISE EXCEPTION 'Candidate regression failures'; END IF; IF NOT EXISTS(SELECT 1 FROM qa_results WHERE phase='baseline' AND NOT passed) THEN RAISE EXCEPTION 'Baseline did not demonstrate bug'; END IF; END $$;
