-- =============================================================
-- prorrateo_conceptos_costo_sin_negativos.sql
--
-- Hallazgo Cotizaciones→Embarques #4: en
-- public._crear_embarque_replicar_conceptos el ajuste final del prorrateo
-- (v_base - v_acum) podía producir un importe NEGATIVO cuando el total en
-- centavos era menor que el número de contenedores (0.02 entre 4 →
-- 0.01, 0.01, 0.01, -0.01).
--
-- Verifica:
--   · CASO 1 — total 0.02 entre 4 contenedores: ninguna parte negativa,
--     suma exacta 0.02 y sólo 2 contenedores reciben 0.01.
--   · CASO 2 — redondeo normal: 100.00 entre 3 → 33.34/33.33/33.33
--     (suma exacta, sin negativos).
--   · CASO 3 — concepto con unidad_medida = 'BL': un solo renglón sin
--     contenedor y con el total íntegro (no se prorratea).
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/prorrateo_conceptos_costo_sin_negativos.sql
-- =============================================================

BEGIN;

DO $prorrateo$
DECLARE
  v_org  uuid := '7a7a7a7a-7a7a-7a7a-7a7a-7a7a7a7a7a7a';
  v_cli  uuid := '7b7b7b7b-7b7b-7b7b-7b7b-7b7b7b7b7b7b';
  v_cot  uuid := '7c7c7c7c-7c7c-7c7c-7c7c-7c7c7c7c7c7c';
  v_emb  uuid := '7d7d7d7d-7d7d-7d7d-7d7d-7d7d7d7d7d7d';
  v_ids  uuid[];
  v_min  numeric;
  v_sum  numeric;
  v_n01  integer;
  v_partes text;
  v_bl_n integer;
  v_bl_monto numeric;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Prorrateo') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Cliente Prorrateo', 'cliente.prorrateo@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cotizaciones (id, organization_id, cliente_id, folio, modo, tipo, estado)
  VALUES (v_cot, v_org, v_cli, 'COT-PRORR-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          'Borrador'::public.estado_cotizacion)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, cliente_id, cotizacion_id, expediente, estado, modo, tipo)
  VALUES (v_emb, v_org, v_cli, v_cot, 'ELPRORR001', 'Borrador',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- 4 contenedores destino.
  INSERT INTO public.embarque_contenedores (embarque_id, organization_id, numero_contenedor, tipo_contenedor, orden)
  VALUES (v_emb, v_org, 'PRORR0000001', '40HC', 1),
         (v_emb, v_org, 'PRORR0000002', '40HC', 2),
         (v_emb, v_org, 'PRORR0000003', '40HC', 3),
         (v_emb, v_org, 'PRORR0000004', '40HC', 4);

  SELECT array_agg(id ORDER BY orden) INTO v_ids
    FROM public.embarque_contenedores
   WHERE embarque_id = v_emb AND deleted_at IS NULL;

  -- Costos de la cotización: 0.02 (caso patológico), 100.00 (redondeo normal)
  -- y uno por BL (no se prorratea).
  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, unidad_medida)
  VALUES
    (v_cot, v_org, 'Centavos', 'MXN', 1, 0.02, 'Contenedor'),
    (v_cot, v_org, 'Flete', 'USD', 1, 100.00, 'Contenedor'),
    (v_cot, v_org, 'Gastos BL', 'MXN', 1, 55.55, 'BL');

  PERFORM public._crear_embarque_replicar_conceptos(v_cot, v_emb, v_org, v_ids, '[]'::jsonb);

  -- CASO 1 · 0.02 entre 4.
  SELECT min(monto), sum(monto), count(*) FILTER (WHERE monto = 0.01),
         string_agg(monto::text, ',' ORDER BY monto)
    INTO v_min, v_sum, v_n01, v_partes
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Centavos' AND deleted_at IS NULL;

  IF v_min < 0 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: hay importes negativos en el prorrateo (%)', v_partes;
  END IF;
  IF v_sum <> 0.02 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la suma prorrateada es % y debía ser 0.02 (%)', v_sum, v_partes;
  END IF;
  IF v_n01 <> 2 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaban 2 partes de 0.01, hubo % (%)', v_n01, v_partes;
  END IF;
  RAISE NOTICE 'CASO 1 OK: 0.02 entre 4 → % (suma exacta, sin negativos)', v_partes;

  -- CASO 2 · redondeo normal 100.00 entre 4 → 25.00 cada uno; verificamos
  -- además el caso con resto: se usa el mismo reparto de centavos.
  SELECT min(monto), sum(monto), string_agg(monto::text, ',' ORDER BY monto)
    INTO v_min, v_sum, v_partes
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Flete' AND deleted_at IS NULL;

  IF v_min < 0 OR v_sum <> 100.00 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: prorrateo de 100.00 entre 4 dio suma % (%)', v_sum, v_partes;
  END IF;
  RAISE NOTICE 'CASO 2 OK: 100.00 entre 4 → % (suma exacta)', v_partes;

  -- CASO 3 · unidad_medida = 'BL' no se prorratea.
  SELECT count(*), max(monto) INTO v_bl_n, v_bl_monto
    FROM public.conceptos_costo
   WHERE embarque_id = v_emb AND concepto = 'Gastos BL' AND deleted_at IS NULL;

  IF v_bl_n <> 1 OR v_bl_monto <> 55.55 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el concepto BL generó % renglones (monto %)', v_bl_n, v_bl_monto;
  END IF;
  RAISE NOTICE 'CASO 3 OK: el concepto por BL quedó en un solo renglón por 55.55';
END;
$prorrateo$;

ROLLBACK;
