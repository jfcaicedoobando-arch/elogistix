-- PROPOSED READ-ONLY QUERIES; NOT EXECUTED BY THIS WORKER.
SELECT jsonb_build_object(
 'relation', (to_jsonb(c) - ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']),
 'namespace',to_jsonb(n),
 'attributes',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attnum),'[]') FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid),
 'defaults_sha256',encode(sha256(convert_to(((SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.adnum),'[]') FROM pg_catalog.pg_attrdef a WHERE a.adrelid=c.oid))::text,'UTF8')),'hex'),
 'constraints',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.oid),'[]') FROM pg_catalog.pg_constraint x WHERE x.conrelid=c.oid OR x.confrelid=c.oid),
 'indexes',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.indexrelid),'[]') FROM pg_catalog.pg_index x WHERE x.indrelid=c.oid),
 'triggers_sha256',encode(sha256(convert_to(((SELECT coalesce(jsonb_agg(jsonb_build_object('trigger',to_jsonb(t),'function',to_jsonb(p)) ORDER BY t.oid),'[]') FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid=c.oid))::text,'UTF8')),'hex'),
 'rules_sha256',encode(sha256(convert_to(((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.oid),'[]') FROM pg_catalog.pg_rewrite x WHERE x.ev_class=c.oid))::text,'UTF8')),'hex'),
 'policies_sha256',encode(sha256(convert_to(((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.oid),'[]') FROM pg_catalog.pg_policy x WHERE x.polrelid=c.oid))::text,'UTF8')),'hex'),
 'inheritance',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.inhrelid,x.inhparent),'[]') FROM pg_catalog.pg_inherits x WHERE x.inhrelid=c.oid OR x.inhparent=c.oid),
 'sequence_name',pg_catalog.pg_get_serial_sequence('drizzle.__drizzle_migrations','id'),
 'sequence_metadata',(SELECT to_jsonb(s) FROM pg_catalog.pg_sequence s WHERE s.seqrelid=pg_catalog.to_regclass(pg_catalog.pg_get_serial_sequence('drizzle.__drizzle_migrations','id')))
) AS ledger_metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE c.oid=pg_catalog.to_regclass('drizzle.__drizzle_migrations');

SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') AS exact_history FROM drizzle.__drizzle_migrations d;

SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.version),'[]')::text,'UTF8')),'hex') AS supabase_history_digest FROM supabase_migrations.schema_migrations s;
