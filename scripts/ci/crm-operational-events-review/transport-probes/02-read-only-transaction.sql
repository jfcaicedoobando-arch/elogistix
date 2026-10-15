-- Submit this complete file once in one call. Do not split it into calls.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1', 'probe', 'transaction',
    'admission', 'NOT_ADMITTED', 'stage', 'A_INSIDE',
    'database', pg_catalog.current_database(),
    'backend_pid', pg_catalog.pg_backend_pid(),
    'user', current_user, 'session_user', session_user,
    'isolation', pg_catalog.current_setting('transaction_isolation'),
    'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
    'own_virtualxids', (
        SELECT pg_catalog.jsonb_agg(l.virtualxid ORDER BY l.virtualxid)
        FROM pg_catalog.pg_locks AS l
        WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
          AND l.locktype OPERATOR(pg_catalog.=) 'virtualxid' AND l.mode OPERATOR(pg_catalog.=) 'ExclusiveLock' AND l.granted
    ),
    'query_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.current_query(), 'UTF8')), 'hex')
) AS crm_transport_probe;

SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1', 'probe', 'transaction',
    'admission', 'NOT_ADMITTED', 'stage', 'B_INSIDE',
    'database', pg_catalog.current_database(),
    'backend_pid', pg_catalog.pg_backend_pid(),
    'user', current_user, 'session_user', session_user,
    'isolation', pg_catalog.current_setting('transaction_isolation'),
    'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
    'own_virtualxids', (
        SELECT pg_catalog.jsonb_agg(l.virtualxid ORDER BY l.virtualxid)
        FROM pg_catalog.pg_locks AS l
        WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
          AND l.locktype OPERATOR(pg_catalog.=) 'virtualxid' AND l.mode OPERATOR(pg_catalog.=) 'ExclusiveLock' AND l.granted
    ),
    'query_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.current_query(), 'UTF8')), 'hex')
) AS crm_transport_probe;

COMMIT;

SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1', 'probe', 'transaction',
    'admission', 'NOT_ADMITTED', 'stage', 'C_AFTER_COMMIT',
    'database', pg_catalog.current_database(),
    'backend_pid', pg_catalog.pg_backend_pid(),
    'user', current_user, 'session_user', session_user,
    'isolation', pg_catalog.current_setting('transaction_isolation'),
    'transaction_read_only', pg_catalog.current_setting('transaction_read_only'),
    'own_virtualxids', (
        SELECT pg_catalog.jsonb_agg(l.virtualxid ORDER BY l.virtualxid)
        FROM pg_catalog.pg_locks AS l
        WHERE l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()
          AND l.locktype OPERATOR(pg_catalog.=) 'virtualxid' AND l.mode OPERATOR(pg_catalog.=) 'ExclusiveLock' AND l.granted
    ),
    'query_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.current_query(), 'UTF8')), 'hex')
) AS crm_transport_probe;
