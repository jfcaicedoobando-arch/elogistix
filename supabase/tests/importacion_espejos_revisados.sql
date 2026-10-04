-- AUD40: prueba RPC real con pagos, espejos, guards y roles activos.
BEGIN;
\i supabase/tests/rls/_helpers.sql
\i supabase/tests/_audit40_importacion_fixture.sql

-- nextval no se revierte: demuestra preflight antes del primer intento de
-- UPDATE, incluso si un subbloque capturara el error y revirtiera sus filas.
CREATE TEMP SEQUENCE audit40_intentos_update;
SELECT nextval('pg_temp.audit40_intentos_update');
GRANT SELECT ON SEQUENCE pg_temp.audit40_intentos_update TO authenticated;
CREATE FUNCTION pg_temp.audit40_contar_intentos_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM nextval('pg_temp.audit40_intentos_update');
  RETURN NEW;
END;
$$;
CREATE TRIGGER _audit40_contar_intentos_update
AFTER UPDATE ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION pg_temp.audit40_contar_intentos_update();

DO $tests$
DECLARE
  v_orgs record;
  v_cuenta uuid := gen_random_uuid();
  v_otra uuid := gen_random_uuid();
  v_fecha date := public.fecha_negocio_mx();
  v_mov uuid;
  v_otro uuid;
  v_fila jsonb;
  v_segunda jsonb;
  v_reporte jsonb;
  v_pago uuid;
  v_nuevos jsonb;
  v_intentos bigint;
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD40');
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, moneda, saldo_inicial, fecha_saldo_inicial)
  VALUES (v_cuenta, v_orgs.org_a, 'AUD40 BANCO', 'MXN', 0, v_fecha - 10),
         (v_otra, v_orgs.org_a, 'AUD40 OTRA', 'MXN', 0, v_fecha - 10);
  PERFORM pg_temp.as_user(v_orgs.admin_a);

  -- Coincidencia revisada: mismo movimiento/pago, un solo abono y retry no-op.
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 100, v_fecha);
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40-IMPORTADO-100');
  SELECT pago_factura_id INTO v_pago FROM public.bbva_movimientos WHERE id = v_mov;
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 1 AND EXISTS (
    SELECT 1 FROM public.bbva_movimientos WHERE id = v_mov AND hash_dedupe = 'AUD40-IMPORTADO-100'
      AND pago_factura_id = v_pago AND abono = 100 AND cargo = 0), 'AUD40: no conservó el origen financiero');
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 0, 'AUD40: retry debe omitir hash vivo sin mutar');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.bbva_movimientos WHERE cuenta_bancaria_id = v_cuenta) = 1,
    'AUD40: retry duplicó el movimiento');

  -- Una fila posterior obsoleta impide incluso UPDATE/auditoría de la primera.
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 101, v_fecha);
  v_otro := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 102, v_fecha);
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40-LOTE-101');
  v_segunda := pg_temp.audit40_fila(v_otro, 'AUD40-LOTE-102');
  UPDATE public.bbva_movimientos SET fecha = v_fecha - 1 WHERE id = v_otro;
  SELECT last_value INTO v_intentos FROM pg_temp.audit40_intentos_update;
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_fila, v_segunda), 'LC_IMPORTACION_REVISION_CAMBIO');
  PERFORM pg_temp.assert((SELECT last_value FROM pg_temp.audit40_intentos_update) = v_intentos,
    'AUD40: se intentó un UPDATE antes de verificar todo el lote');
  -- Sigue dentro de ±3 días: ID e importe solos no detectarían el cambio.
  v_segunda := pg_temp.audit40_fila(v_otro, 'AUD40-LOTE-102');
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila, v_segunda));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 2, 'AUD40: revisión renovada debe permitir el lote');

  -- Un espejo no puede ser consumido por dos filas; null expreso no busca otro.
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 110, v_fecha);
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40-ORDEN-A');
  v_segunda := pg_temp.audit40_fila(v_mov, 'AUD40-ORDEN-B');
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_fila, v_segunda), 'LC_IMPORTACION_REVISION_CAMBIO');
  v_segunda := jsonb_set(v_segunda, '{espejo_revisado_id}', 'null'::jsonb);
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila, v_segunda, v_fila));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 1, 'AUD40: orden/duplicado consumió otro espejo');

  -- La revisión de una fila nueva no autoriza un cobro aparecido después.
  v_nuevos := jsonb_build_object('fecha', v_fecha, 'cargo', 0, 'abono', 120,
    'hash_dedupe', 'AUD40-NUEVO-120', 'espejo_revisado_id', NULL);
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 120, v_fecha);
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_nuevos), 'LC_IMPORTACION_REVISION_CAMBIO');

  -- Coincidencias ambiguas no se absorben; confirmar un ID ambiguo falla.
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 130, v_fecha);
  v_otro := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 130, v_fecha);
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40-AMBIGUA');
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_fila), 'LC_IMPORTACION_REVISION_CAMBIO');
  v_fila := jsonb_set(v_fila, '{espejo_revisado_id}', 'null'::jsonb);
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_fila));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 0, 'AUD40: ambigüedad no debe elegir un espejo');

  -- Huella obligatoria, mezcla revisada/legacy y cuenta distinta: fail-closed.
  v_mov := pg_temp.audit40_espejo(v_orgs.org_a, v_cuenta, 140, v_fecha);
  v_fila := pg_temp.audit40_fila(v_mov, 'AUD40-HUELLA');
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_fila - 'espejo_revisado_huella'), 'LC_IMPORTACION_REVISION_INVALIDA');
  v_segunda := v_fila - 'espejo_revisado_id' - 'espejo_revisado_huella';
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(v_fila, v_segunda), 'LC_IMPORTACION_REVISION_INVALIDA');
  PERFORM pg_temp.audit40_rechazo(v_otra, jsonb_build_array(v_fila), 'LC_IMPORTACION_REVISION_CAMBIO');
  PERFORM pg_temp.audit40_rechazo(v_cuenta, jsonb_build_array(jsonb_set(v_fila,
    '{espejo_revisado_huella,pago_factura_id}', to_jsonb(gen_random_uuid()))), 'LC_IMPORTACION_REVISION_CAMBIO');

  -- Legacy conserva la absorción inequívoca y no cambia la firma RPC.
  v_reporte := public.absorber_espejos_importacion(v_cuenta, jsonb_build_array(v_segunda));
  PERFORM pg_temp.assert((v_reporte->>'absorbidos')::int = 1, 'AUD40: contrato legacy cambió');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD40: revisión, carreras, lote atómico, consumo, ambigüedad, retry y legacy protegidos';
END;
$tests$;
ROLLBACK;
