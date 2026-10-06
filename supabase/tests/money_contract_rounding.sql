-- Pure numeric parity test, no business writes or schema changes.
BEGIN;
DO $test$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
    (1.005::numeric, 1.01::numeric), (-1.005, -1.01),
    (10.075, 10.08), (-10.075, -10.08),
    (0.125, 0.13), (-0.125, -0.13)
  ) AS vectors(input, rounded)
  LOOP
    IF round(v.input, 2) <> v.rounded THEN
      RAISE EXCEPTION 'Monetary contract mismatch: %', v.input;
    END IF;
  END LOOP;
  IF round(10.075::numeric - 1.005 + 1.005, 2) <> 10.08 THEN
    RAISE EXCEPTION 'Monetary cancellation drift';
  END IF;
END;
$test$;
ROLLBACK;
