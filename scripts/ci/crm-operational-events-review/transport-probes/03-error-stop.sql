-- Intentionally no BEGIN: a server-side implicit query block closes on error.
-- If an unknown outer wrapper opens a transaction, its cleanup remains unknown.
SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1', 'probe', 'error',
    'admission', 'NOT_ADMITTED', 'stage', 'BEFORE_ERROR',
    'marker', 'CRM_TRANSPORT_BEFORE_ERROR'
) AS crm_transport_probe;

SELECT 1 OPERATOR(pg_catalog./) 0 AS "CRM_TRANSPORT_EXPECTED_SQLSTATE_22012";

SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1', 'probe', 'error',
    'admission', 'NOT_ADMITTED', 'stage', 'AFTER_ERROR',
    'marker', 'CRM_TRANSPORT_AFTER_ERROR_MUST_NOT_RUN'
) AS crm_transport_probe;
