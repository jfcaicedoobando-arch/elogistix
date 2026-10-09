-- Preserve complete trigger semantics, including the logical FK identity.
-- Raw internal trigger names intentionally retain database-specific OIDs.
SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY relation,name)) FROM (
 SELECT c.oid::regclass::text relation,t.tgname name,t.tgenabled enabled,
 t.tgisinternal internal,pg_get_triggerdef(t.oid,true) definition,
 p.oid::regprocedure::text function,t.tgtype type_bits,
 t.tgdeferrable deferrable,t.tginitdeferred initially_deferred,
 t.tgattr::text attribute_numbers,con.conname constraint_name,
 pg_get_constraintdef(con.oid,true) constraint_definition,
 CASE WHEN con.confrelid<>0 THEN con.confrelid::regclass::text END constraint_referenced_relation
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
 LEFT JOIN pg_constraint con ON con.oid=t.tgconstraint
 WHERE n.nspname='public'
)q;
