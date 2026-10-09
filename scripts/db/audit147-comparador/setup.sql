CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE ROLE service_role;
CREATE ROLE sandbox_exec;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE organization_members(organization_id uuid,user_id uuid);
CREATE TABLE costeo_agentes(id uuid PRIMARY KEY,nombre text,dias_credito integer,activo boolean);
CREATE TABLE navieras(id uuid PRIMARY KEY,name text);
CREATE TABLE costeo_rutas(id uuid PRIMARY KEY,puerto_origen_id uuid,puerto_destino_id uuid);
CREATE TABLE puertos(id uuid PRIMARY KEY,name text,code text,country text);
CREATE TABLE tipos_contenedor(id uuid PRIMARY KEY,name text);
CREATE TABLE costeo_tarifas(id uuid PRIMARY KEY, organization_id uuid, agente_id uuid, naviera_id uuid,ruta_id uuid,tipo_contenedor_id uuid,moneda text,flete_base numeric,dias_libres_demoras integer,transit_time_dias integer,vigente_desde date,vigente_hasta date,estado text,estado_aprobacion text,dias_libres_almacenaje_lcl integer,frecuencia_override text);
CREATE TABLE costeo_tarifa_recargos(tarifa_id uuid,monto numeric,incluido_en_total boolean);
CREATE TABLE costeo_navieras_condiciones(id uuid PRIMARY KEY,naviera_id uuid,organization_id uuid,tiene_carta_garantia boolean,carta_garantia_vigente_hasta date,dias_libres_demoras_default integer,frecuencia text);
CREATE TABLE costeo_naviera_demoras_tarifa(id uuid PRIMARY KEY,naviera_condicion_id uuid,tipo_contenedor_id uuid,desde_dia integer,hasta_dia integer,monto_por_dia numeric(12,2),moneda text,organization_id uuid,UNIQUE(naviera_condicion_id,tipo_contenedor_id,desde_dia));
\i old-view.sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.costeo_tarifas_vigentes_v TO anon,service_role,sandbox_exec;
\i live-get-top-tarifas.sql
REVOKE ALL ON FUNCTION get_top_tarifas(uuid,uuid,uuid,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_top_tarifas(uuid,uuid,uuid,date,uuid) TO authenticated,service_role;
ALTER TABLE costeo_tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY scope_tarifas ON costeo_tarifas FOR SELECT USING (EXISTS(SELECT 1 FROM organization_members om WHERE om.organization_id=costeo_tarifas.organization_id AND om.user_id=auth.uid()));
SELECT md5(pg_get_viewdef('costeo_tarifas_vigentes_v'::regclass,true)) AS baseline_view_hash;
