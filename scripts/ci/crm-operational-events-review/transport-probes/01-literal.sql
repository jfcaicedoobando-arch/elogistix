-- Public transport probe: one SELECT; no application SQL is executed.
SELECT pg_catalog.jsonb_build_object(
    'kind', 'crm-transport-probe-v1',
    'probe', 'literal',
    'admission', 'NOT_ADMITTED',
    'marker', 'CRM_TRANSPORT_LITERAL_COMPLETE',
    'server_encoding', pg_catalog.current_setting('server_encoding'),
    'client_encoding', pg_catalog.current_setting('client_encoding'),
    'literal_utf8_octets', pg_catalog.octet_length(pg_catalog.convert_to(p.value, 'UTF8')),
    'literal_utf8_hex', pg_catalog.encode(pg_catalog.convert_to(p.value, 'UTF8'), 'hex'),
    'literal_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.value, 'UTF8')), 'hex'),
    'query_utf8_octets', pg_catalog.octet_length(pg_catalog.convert_to(pg_catalog.current_query(), 'UTF8')),
    'query_sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.current_query(), 'UTF8')), 'hex')
) AS crm_transport_probe
FROM (VALUES ($crm_transport_literal$CRM transport v1
semicolon ; quote ' double " backslash \
-- literal, not a comment
/* literal ; $body$ BEGIN END; $body$ */
acentos: á ñ Ω
END
$crm_transport_literal$::pg_catalog.text)) AS p(value);
