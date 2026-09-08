-- Regresión focalizada para GitHub Actions; no se ejecuta localmente.
BEGIN;

SELECT plan(10);

SELECT has_column('public', 'conceptos_costo', 'cotizacion_costo_origen_id',
  'R201-COT-01 conserva identidad del costo fuente');
SELECT col_is_null('public', 'conceptos_costo', 'cotizacion_costo_origen_id',
  'la identidad es nullable para costos manuales e históricos');
SELECT fk_ok('public', 'conceptos_costo', 'cotizacion_costo_origen_id',
             'public', 'cotizacion_costos', 'id',
  'la identidad apunta al renglón exacto de cotización');

SELECT function_returns('public', '_embarque_aplicar_tarifa_decidida', ARRAY['uuid','uuid','uuid'], 'integer',
  'helper de aplicación de tarifa conserva firma');
SELECT function_privs_are('public', '_embarque_aplicar_tarifa_decidida', ARRAY['uuid','uuid','uuid'], 'authenticated', ARRAY[]::text[],
  'authenticated no ejecuta el helper privado');
SELECT function_privs_are('public', '_embarque_aplicar_tarifa_decidida', ARRAY['uuid','uuid','uuid'], 'service_role', ARRAY['EXECUTE'],
  'service_role conserva acceso al helper privado');

SELECT function_returns('public', 'revalidar_tarifa_cotizacion', ARRAY['uuid'], 'jsonb',
  'revalidación conserva contrato jsonb');
SELECT function_privs_are('public', 'revalidar_tarifa_cotizacion', ARRAY['uuid'], 'authenticated', ARRAY['EXECUTE'],
  'authenticated conserva acceso a revalidación');
SELECT function_privs_are('public', 'crear_embarque_borrador_desde_cotizacion', ARRAY['uuid','text','uuid','jsonb'], 'authenticated', ARRAY['EXECUTE'],
  'authenticated conserva acceso al wrapper de creación');
SELECT function_privs_are('public', 'crear_embarque_borrador_core', ARRAY['uuid'], 'authenticated', ARRAY[]::text[],
  'el core permanece cerrado al cliente');

SELECT * FROM finish();
ROLLBACK;