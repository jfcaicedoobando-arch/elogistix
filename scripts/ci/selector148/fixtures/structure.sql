SELECT jsonb_pretty(jsonb_build_object(
 'constraints',(SELECT jsonb_agg(to_jsonb(q) ORDER BY relation,name) FROM (
   SELECT c.conrelid::regclass::text relation,c.conname name,c.contype,
     c.convalidated,c.condeferrable,c.condeferred,c.conislocal,c.connoinherit,
     pg_get_constraintdef(c.oid,true) definition
   FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
   WHERE n.nspname='public') q),
 'indexes',(SELECT jsonb_agg(to_jsonb(q) ORDER BY relation,name) FROM (
   SELECT i.indrelid::regclass::text relation,i.indexrelid::regclass::text name,
     i.indisvalid,i.indisready,i.indisunique,i.indimmediate,i.indisprimary,
     pg_get_indexdef(i.indexrelid) definition
   FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public') q)
));
