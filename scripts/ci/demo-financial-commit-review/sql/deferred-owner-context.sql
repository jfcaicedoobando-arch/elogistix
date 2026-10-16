-- SEPARATE LABORATORY PROPOSAL. Original PR354 and compile sources stay intact.
-- Only the execution identity descriptor changes; this is a privilege elevation.
-- The Actions runner must verify original owner/OID, closed ACL, fixed search_path,
-- exact prosrc hash and deferred enabled trigger binding before applying it.
-- Afterward all captured metadata must be identical except prosecdef=false->true.
-- Original prosrc SHA256:
-- 798520f64eb79590ed9976afff7927df7e9d5627e2a84bbdcf48caa1acf977e9
-- No SQL is applied locally. Real registrations, grants and activation remain absent.
ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() SECURITY DEFINER;
