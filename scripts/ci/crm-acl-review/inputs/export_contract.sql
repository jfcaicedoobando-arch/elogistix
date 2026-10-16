-- Read-only exporter. For fixture identity binding, never silently adopt production drift.
WITH wanted(signature) AS (VALUES ('public._crm_empresa_no_borrar_cliente()'),('public._crm_empresa_no_delete_fisico()')),
f AS (SELECT w.signature,p.* FROM wanted w JOIN pg_catalog.pg_proc p ON p.oid=to_regprocedure(w.signature))
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',signature,'oid',oid,'expected',jsonb_build_object(
 'metadata',to_jsonb(f)-ARRAY['signature','proacl','prosrc','probin','prosqlbody'],
 'prosrc_sha256',encode(sha256(convert_to(prosrc,'UTF8')),'hex'),
 'probin_is_null',probin IS NULL,'prosqlbody_is_null',prosqlbody IS NULL)) ORDER BY signature) FROM f),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_catalog.pg_trigger t WHERE t.tgfoid IN(SELECT oid FROM f)),
 'relation',(SELECT jsonb_build_object('oid',oid,'relkind',relkind,'relispartition',relispartition) FROM pg_catalog.pg_class WHERE oid='public.crm_empresas'::regclass));
