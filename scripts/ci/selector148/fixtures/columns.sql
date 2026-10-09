SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY relation, attnum)) FROM (
 SELECT c.oid::regclass::text relation,a.attname,a.attnum,
        format_type(a.atttypid,a.atttypmod) data_type,a.attnotnull,a.attisdropped,
        a.attgenerated,a.attidentity,a.attacl,
        pg_get_expr(d.adbin,d.adrelid) default_expression,
        CASE WHEN NOT a.attisdropped THEN has_column_privilege('authenticated',c.oid,a.attnum,'SELECT') END authenticated_select,
        CASE WHEN NOT a.attisdropped THEN has_column_privilege('anon',c.oid,a.attnum,'SELECT') END anon_select,
        CASE WHEN NOT a.attisdropped THEN has_column_privilege('service_role',c.oid,a.attnum,'SELECT') END service_role_select
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
) q;
