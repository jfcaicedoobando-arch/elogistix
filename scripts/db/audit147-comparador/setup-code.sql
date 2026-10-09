CREATE FUNCTION resolver_puerto_id(text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM puertos WHERE code=$1 LIMIT 1 $$;
CREATE FUNCTION resolver_tipo_contenedor_id(text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM tipos_contenedor WHERE name=$1 LIMIT 1 $$;
\i live-get-top-por-codigo.sql
REVOKE ALL ON FUNCTION get_top_tarifas_por_codigo(text,text,text,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_top_tarifas_por_codigo(text,text,text,date,uuid) TO authenticated,service_role;
