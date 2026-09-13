-- =============================================================
-- prorrateo_cotizacion_cantidad_multi_contenedor.sql · B-5
--
-- Prueba de CARACTERIZACIÓN (no de corrección): documenta cómo se replican
-- hoy los costos de una cotización con `cantidad > 1` cuando el embarque se
-- crea con N contenedores.
--
-- Comportamiento actual de `_crear_embarque_replicar_conceptos` para costos
-- con unidad_medida = 'Contenedor':
--   base = costo_total (o costo_unitario × cantidad)
--   esa base TOTAL se reparte entre los N contenedores del embarque
--   (método del resto mayor, suma exacta, sin negativos).
--
-- Consecuencia: si la cotización se hizo con cantidad = 2 y el embarque tiene
-- 3 contenedores, el total se conserva pero el costo por contenedor ya no
-- equivale al costo unitario cotizado. La semántica de `cantidad`
-- (contenedores cotizados vs. multiplicador de unidades) es una decisión de
-- producto pendiente: esta prueba sólo fija el comportamiento vigente para
-- detectar cambios involuntarios.
--
-- Casos:
--   1) cantidad 2 × 100.00 = 200.00 entre 3 contenedores -> 66.67/66.67/66.66
--   2) cantidad 3 × 50.00 = 150.00 entre 3 contenedores -> 50.00 cada uno
--   3) cantidad 2 con unidad_medida 'BL' -> un renglón por el total (200.00)
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/prorrateo_cotizacion_cantidad_multi_contenedor.sql
-- =============================================================

BEGIN;

DO $b5$
DECLARE
  v_org uuid := '5b5b5b5b-0000-4000-8000-000000000010';
  v_cli uuid := '5b5b5b5b-0000-4000-8000-000000000020';
  v_cot uuid := '5b5b5b5b-0000-4000-8000-000000000030';
  v_emb uuid := '5b5b5b5b-0000-4000-8000-000000000040';
  v_ids uuid[];
  v_sum numeric;
  v_min numeric;
  v_partes text;
  v_n integer;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org B5 Prorrateo Cantidad') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Cliente B5', 'cliente.b5@test.mx') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cotizaciones (id, organization_id, cliente_id, folio, modo, tipo, estado)
  VALUES (v_cot, v_org, v_cli, 'COT-B5-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          'Borrador'::public.estado_cotizacion)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, cliente_id, cotizacion_id, expediente, estado, modo, tipo)
  VALUES (v_emb, v_org, v_cli, v_cot, 'ELCNT0001', 'Borrador',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarque_contenedores (embarque_id, organization_id, numero_contenedor, tipo_contenedor, orden)
  VALUES (v_emb, v_org, 'BBBU1234561', '40HC', 1),
         (v_emb, v_org, 'BBBU1234562', '40HC', 2),
         (v_emb, v_org, 'BBBU1234563', '40HC', 3);

  SELECT array_agg(id ORDER BY orden) INTO v_ids
    FROM public.embarque_contenedores
   WHERE embarque_id = v_emb AND deleted_at IS NULL;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, unidad_medida)
  VALUES
    (v_cot, v_org, 'Flete por contenedor', 'USD', 2, 100.00, 'Contenedor'),
    (v_cot, v_org, 'Maniobras', 'MXN', 3, 50.00, 'Contenedor'),
    (v_cot, v_org, 'Gastos por BL', 'MXN', 2, 100.00, 'BL');

  PERFORM public._crear_embarque_replicar_conceptos(v_cot, v_emb, v_org, v_ids, '[]'::jsonb);

  -- CASO 1 · 2 × 100.00 = 200.00 repartido entre 3 contenedores.
  SELECT count(*), sum(monto), min(monto), string_agg(monto::text, ',' ORDER BY monto DESC)
    INTO v_n, v_sum, v_min, v_partes
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Flete por contenedor' AND deleted_at IS NULL;

  IF v_n <> 3 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaban 3 renglones (uno por contenedor), hubo %', v_n;
  END IF;
  IF v_sum <> 200.00 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la suma prorrateada es % y debía conservar 200.00 (%)', v_sum, v_partes;
  END IF;
  IF v_min < 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: hay importes negativos (%)', v_partes;
  END IF;
  IF v_partes <> '66.67,66.67,66.66' THEN
    RAISE EXCEPTION 'CASO 1 CAMBIÓ: el reparto vigente era 66.67,66.67,66.66 y ahora es % — confirma la semántica de cantidad antes de aceptar el cambio', v_partes;
  END IF;
  RAISE NOTICE 'CASO 1 OK (caracterización): cantidad 2 × 100.00 entre 3 contenedores → % (total conservado, unitario diluido)', v_partes;

  -- CASO 2 · cantidad = número de contenedores: coincide con el unitario.
  SELECT sum(monto), min(monto), string_agg(monto::text, ',' ORDER BY monto)
    INTO v_sum, v_min, v_partes
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Maniobras' AND deleted_at IS NULL;

  IF v_sum <> 150.00 OR v_min <> 50.00 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: 3 × 50.00 entre 3 contenedores dio % (%)', v_sum, v_partes;
  END IF;
  RAISE NOTICE 'CASO 2 OK: cantidad = contenedores → 50.00 por contenedor';

  -- CASO 3 · unidad_medida 'BL': un solo renglón con el total.
  SELECT count(*), max(monto) INTO v_n, v_sum
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Gastos por BL' AND deleted_at IS NULL;

  IF v_n <> 1 OR v_sum <> 200.00 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el concepto por BL generó % renglones (monto %)', v_n, v_sum;
  END IF;
  RAISE NOTICE 'CASO 3 OK: el concepto por BL queda en un renglón por 200.00 (cantidad × unitario)';
END;
$b5$;

ROLLBACK;
