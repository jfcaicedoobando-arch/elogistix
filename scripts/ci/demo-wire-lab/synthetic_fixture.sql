-- SYNTHETIC business fixture: Actions-only disposable database, no real engine/issuer/identity.
-- No unique event constraint masks duplicate business execution.
CREATE SCHEMA demo_wire_synthetic;
CREATE TABLE demo_wire_synthetic.business_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY,
  context_id uuid NOT NULL
);
CREATE FUNCTION demo_owner_review.unbound_business_entrypoint(p_context uuid,p_skip bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM demo_owner_review.claims WHERE context_id=p_context AND stage='ingress')
    THEN RAISE EXCEPTION 'SYNTHETIC claim missing'; END IF;
  INSERT INTO demo_wire_synthetic.business_events(context_id) VALUES (p_context);
  IF p_skip=999 THEN RAISE EXCEPTION 'SYNTHETIC business failure'; END IF;
  RETURN jsonb_build_object('scope','SYNTHETIC','effect','fixture only');
END $$;
