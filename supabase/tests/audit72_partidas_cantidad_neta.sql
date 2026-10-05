-- Auditoría 72. Sólo PostgreSQL efímero: fixtures nuevos y ROLLBACK.
-- monto es unitario; cantidad multiplica el subtotal neto, no IVA/IEPS.
-- Conserva la clasificación de huérfanos: el hallazgo 63 se corrige en PR127.
BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_fx record;
  v_prov uuid := gen_random_uuid();
  v_prov_ajeno uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cat_ajena uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_emb uuid := gen_random_uuid();
  v_costo uuid := gen_random_uuid();
  v_fp15 uuid := gen_random_uuid();
  v_ajena uuid := gen_random_uuid();
  v_parcial uuid := gen_random_uuid();
  v_decimal uuid := gen_random_uuid();
  v_usd uuid := gen_random_uuid();
  v_cancelada uuid := gen_random_uuid();
  v_eliminada uuid := gen_random_uuid();
  v_vinculo uuid := gen_random_uuid();
  v_nc uuid := gen_random_uuid();
  v_res jsonb;
  v_partida jsonb;
  v_huerfana jsonb;
  v_error text;
BEGIN
  SELECT * INTO STRICT v_fx FROM pg_temp.seed_org_pair('AUD72');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
  VALUES (v_prov, v_fx.org_a, 'AUD72 proveedor', 'Logistico', 'Naviera'),
         (v_prov_ajeno, v_fx.org_b, 'AUD72 proveedor ajeno', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (v_cat, v_fx.org_a, 'AUD72 costo'), (v_cat_ajena, v_fx.org_b, 'AUD72 costo ajeno');
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_fx.org_a, 'AUD72 cliente', 'audit72@test.local');
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_emb, v_fx.org_a, v_cli, 'DEMO-2026-720001', 'Marítimo', 'Importación');
  INSERT INTO public.conceptos_costo(id, organization_id, embarque_id, proveedor_id, concepto, monto, moneda)
  VALUES (v_costo, v_fx.org_a, v_emb, v_prov, 'AUD72 costo ligado', 40, 'MXN');

  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    moneda, subtotal, iva, ieps, total, estado, estado_aprobacion
  ) VALUES
    (v_fp15, v_fx.org_a, v_prov, v_cat, 'AUD72-FP15-' || gen_random_uuid(), 'MXN', 3, 0, 0, 3, 'Vigente', 'pendiente'),
    (v_ajena, v_fx.org_b, v_prov_ajeno, v_cat_ajena, 'AUD72-AJENA-' || gen_random_uuid(), 'MXN', 3, 0, 0, 3, 'Vigente', 'pendiente'),
    (v_parcial, v_fx.org_a, v_prov, v_cat, 'AUD72-PARCIAL-' || gen_random_uuid(), 'MXN', 40, 6.4, 2, 48.4, 'Vigente', 'pendiente'),
    (v_decimal, v_fx.org_a, v_prov, v_cat, 'AUD72-DECIMAL-' || gen_random_uuid(), 'MXN', 4, 0, 0, 4, 'Vigente', 'pendiente'),
    (v_usd, v_fx.org_a, v_prov, v_cat, 'AUD72-USD-' || gen_random_uuid(), 'USD', 3, 0, 0, 3, 'Vigente', 'pendiente'),
    (v_cancelada, v_fx.org_a, v_prov, v_cat, 'AUD72-CANCELADA-' || gen_random_uuid(), 'MXN', 3, 0, 0, 3, 'Cancelada', 'pendiente'),
    (v_eliminada, v_fx.org_a, v_prov, v_cat, 'AUD72-ELIMINADA-' || gen_random_uuid(), 'MXN', 3, 0, 0, 3, 'Vigente', 'pendiente');

  INSERT INTO public.proveedor_facturas_conceptos(
    organization_id, proveedor_factura_id, descripcion, cantidad, monto, iva, ieps
  ) VALUES
    (v_fx.org_a, v_fp15, 'AUD72 3 unidades de MXN1', 3, 1, 0, 0),
    (v_fx.org_b, v_ajena, 'AUD72 tenant ajeno', 3, 1, 0, 0),
    (v_fx.org_a, v_parcial, 'AUD72 neto sin vincular 10, impuestos separados', 2, 5, 1.6, 2),
    (v_fx.org_a, v_decimal, 'AUD72 cantidad decimal', 0.125, 8, 0, 0),
    (v_fx.org_a, v_decimal, 'AUD72 cantidad cero legada equivale a uno', 0, 2, 0, 0),
    (v_fx.org_a, v_decimal, 'AUD72 cantidad uno', 1, 1, 0, 0),
    (v_fx.org_a, v_usd, 'AUD72 conserva moneda', 3, 1, 0, 0),
    (v_fx.org_a, v_cancelada, 'AUD72 no sumar cancelada', 3, 1, 0, 0),
    (v_fx.org_a, v_eliminada, 'AUD72 no sumar eliminada', 3, 1, 0, 0);
  INSERT INTO public.proveedor_facturas_conceptos(
    id, organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto, iva
  ) VALUES (v_vinculo, v_fx.org_a, v_parcial, v_costo, 'AUD72 ligado: neto 30, IVA 4.8', 3, 10, 4.8);
  UPDATE public.proveedor_facturas SET deleted_at = now() WHERE id = v_eliminada;
  INSERT INTO public.proveedor_notas_credito(
    id, organization_id, proveedor_factura_id, fecha, monto, moneda, estado
  ) VALUES (v_nc, v_fx.org_a, v_parcial, CURRENT_DATE, 24.2, 'MXN', 'Borrador');
  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = v_nc;
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = v_nc;

  PERFORM pg_temp.as_user(v_fx.admin_a);
  v_res := public.proveedor_estado_cuenta(v_prov);
  SELECT h INTO v_huerfana FROM jsonb_array_elements(v_res->'facturas_huerfanas') h
  WHERE h->>'factura_id' = v_fp15::text;
  PERFORM pg_temp.assert((v_huerfana->>'monto_sin_vincular')::numeric IS NOT DISTINCT FROM 3::numeric,
    'AUD72 FP15: 3×MXN1 debe alertar MXN3');
  PERFORM pg_temp.assert((v_huerfana->>'partidas')::int IS NOT DISTINCT FROM 1,
    'AUD72: cantidad de unidades no debe multiplicar el conteo de partidas');
  SELECT h INTO v_huerfana FROM jsonb_array_elements(v_res->'facturas_huerfanas') h
  WHERE h->>'factura_id' = v_parcial::text;
  PERFORM pg_temp.assert((v_huerfana->>'monto_sin_vincular')::numeric IS NOT DISTINCT FROM 10::numeric
    AND (v_huerfana->>'partidas')::int IS NOT DISTINCT FROM 1,
    'AUD72: sólo el neto no vinculado, sin sumar IVA/IEPS ni la partida ligada');
  SELECT h INTO v_huerfana FROM jsonb_array_elements(v_res->'facturas_huerfanas') h
  WHERE h->>'factura_id' = v_decimal::text;
  PERFORM pg_temp.assert((v_huerfana->>'monto_sin_vincular')::numeric IS NOT DISTINCT FROM 4::numeric,
    'AUD72: cantidad decimal y cero legado siguen el contrato del cuadre');
  SELECT h INTO v_huerfana FROM jsonb_array_elements(v_res->'facturas_huerfanas') h
  WHERE h->>'factura_id' = v_usd::text;
  PERFORM pg_temp.assert((v_huerfana->>'monto_sin_vincular')::numeric IS NOT DISTINCT FROM 3::numeric
    AND v_huerfana->>'moneda' IS NOT DISTINCT FROM 'USD',
    'AUD72: la alerta debe mantener la moneda de la factura');
  PERFORM pg_temp.assert(NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_res->'facturas_huerfanas') h
    WHERE h->>'factura_id' IN (v_cancelada::text, v_eliminada::text)
  ), 'AUD72: facturas canceladas/eliminadas siguen fuera de la alerta');

  SELECT p INTO v_partida FROM jsonb_array_elements(v_res->'partidas') p
  WHERE p->>'concepto_costo_id' = v_costo::text;
  PERFORM pg_temp.assert((v_partida->>'facturado')::numeric IS NOT DISTINCT FROM 30::numeric
    AND (v_partida->>'por_facturar')::numeric IS NOT DISTINCT FROM 10::numeric,
    'AUD72: respaldo ligado y pendiente usan el subtotal neto de 3×10');
  PERFORM pg_temp.assert((v_partida->>'pagado')::numeric IS NOT DISTINCT FROM 18.15::numeric,
    'AUD72: prorrateo debe usar 30/40 del abono 24.2, no 10/40');

  v_res := public.proveedor_estado_cuenta(v_prov_ajeno);
  PERFORM pg_temp.assert(jsonb_array_length(v_res->'partidas') = 0
    AND jsonb_array_length(v_res->'facturas_huerfanas') = 0,
    'AUD72: el cambio no permite lecturas de otro tenant');
  PERFORM pg_temp.as_postgres();

  BEGIN
    INSERT INTO public.proveedor_facturas_conceptos(
      organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto
    ) VALUES (v_fx.org_a, v_parcial, v_costo, 'AUD72 30+2×6.1 excede 40+5%', 2, 6.1);
    RAISE EXCEPTION 'AUD72: el vínculo ignoró cantidad y aceptó una sobreasignación';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_CXP_VINCULO_SOBREASIGNADO%',
      'AUD72: error esperado al sobreasignar, obtenido ' || v_error);
  END;
  BEGIN
    UPDATE public.proveedor_facturas_conceptos SET cantidad = 5 WHERE id = v_vinculo;
    RAISE EXCEPTION 'AUD72: cambiar sólo cantidad saltó el guard de vínculo';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_CXP_VINCULO_SOBREASIGNADO%',
      'AUD72: error esperado al editar cantidad, obtenido ' || v_error);
  END;
  PERFORM pg_temp.assert(has_function_privilege('authenticated', 'public.proveedor_estado_cuenta(uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.proveedor_estado_cuenta(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.proveedor_estado_cuenta(uuid)', 'EXECUTE'),
    'AUD72: grants del RPC deben conservarse');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD72 OK: alerta, cantidades, neto/impuestos, vínculos, prorrateo y aislamiento';
END;
$tests$;
ROLLBACK;
