-- =============================================================
-- crear_concepto_costo_y_vincular_atomico.sql
--
-- DEFECTO 5 (P1): costo + vínculo de factura de proveedor no eran atómicos.
-- Verifica:
--   · CASO 1 — la RPC existe con la firma esperada (10 parámetros).
--   · CASO 2 — una sola llamada crea EXACTAMENTE un concepto_costo y un
--     puente proveedor_facturas_conceptos.
--   · CASO 3 — repetir la llamada con el MISMO client_request_id no duplica:
--     sigue habiendo un solo concepto y un solo puente.
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/crear_concepto_costo_y_vincular_atomico.sql
-- =============================================================

BEGIN;

-- CASO 1 · la firma existe.
DO $caso1$
BEGIN
  IF to_regprocedure(
       'public.crear_concepto_costo_y_vincular_atomico(uuid, uuid, uuid, text, text, numeric, text, text, date, uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: crear_concepto_costo_y_vincular_atomico no existe con la firma esperada';
  END IF;
  RAISE NOTICE 'CASO 1 OK: la RPC existe';
END;
$caso1$;

-- Fixture: org, proveedor, embarque y factura de proveedor.
DO $fixture$
DECLARE
  v_org uuid := '2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a';
  v_prov uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_emb uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
  v_fact uuid := '2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d';
  v_cli uuid := '2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e';
  v_cat uuid;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Concepto Atomico')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, moneda_preferida, tipo, categoria)
  VALUES (v_prov, v_org, 'Proveedor Atómico', 'MXN',
          'Transportista'::public.tipo_proveedor, 'Logistico'::public.categoria_proveedor)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre)
  VALUES (v_cli, v_org, 'Cliente Atómico')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, estado)
  VALUES (v_emb, v_org, v_cli, 'ELATO0001', 'Confirmado')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre)
  VALUES (v_org, 'Categoría Atómica')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cat;
  IF v_cat IS NULL THEN
    SELECT id INTO v_cat FROM public.presupuesto_categorias
     WHERE organization_id = v_org AND nombre = 'Categoría Atómica' LIMIT 1;
  END IF;

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, folio_proveedor, folio_interno,
     categoria_presupuesto_id, fecha_emision, subtotal, total, moneda, estado)
  VALUES
    (v_fact, v_org, v_prov, 'F-ATOM-1', 'FI-ATOM-1', v_cat, CURRENT_DATE, 1000, 1000, 'MXN', 'Vigente')
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

-- CASO 2 · una llamada crea un concepto y un puente.
DO $caso2$
DECLARE
  v_fact uuid := '2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d';
  v_emb uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
  v_prov uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_clave uuid := '2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e';
  v_resultado jsonb;
  v_n_conceptos int;
  v_n_puentes int;
BEGIN
  v_resultado := public.crear_concepto_costo_y_vincular_atomico(
    v_fact, v_emb, v_prov, 'Proveedor Atómico', 'Flete', 1000, 'MXN',
    'F-ATOM-1', CURRENT_DATE, v_clave
  );

  SELECT count(*) INTO v_n_conceptos
    FROM public.conceptos_costo WHERE client_request_id = v_clave;
  SELECT count(*) INTO v_n_puentes
    FROM public.proveedor_facturas_conceptos
   WHERE concepto_costo_id = (v_resultado->>'concepto_id')::uuid;

  IF v_n_conceptos <> 1 OR v_n_puentes <> 1 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba 1 concepto y 1 puente, hubo % y %', v_n_conceptos, v_n_puentes;
  END IF;
  IF (v_resultado->>'reintento')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la primera llamada no debería marcarse como reintento';
  END IF;
  RAISE NOTICE 'CASO 2 OK: concepto y puente creados de forma atómica';
END;
$caso2$;

-- CASO 3 · repetir con el MISMO client_request_id no duplica.
DO $caso3$
DECLARE
  v_fact uuid := '2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d';
  v_emb uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
  v_prov uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_clave uuid := '2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e';
  v_resultado jsonb;
  v_n_conceptos int;
  v_n_puentes int;
BEGIN
  v_resultado := public.crear_concepto_costo_y_vincular_atomico(
    v_fact, v_emb, v_prov, 'Proveedor Atómico', 'Flete', 1000, 'MXN',
    'F-ATOM-1', CURRENT_DATE, v_clave
  );

  SELECT count(*) INTO v_n_conceptos
    FROM public.conceptos_costo WHERE client_request_id = v_clave;
  SELECT count(*) INTO v_n_puentes
    FROM public.proveedor_facturas_conceptos
   WHERE concepto_costo_id = (v_resultado->>'concepto_id')::uuid;

  IF v_n_conceptos <> 1 OR v_n_puentes <> 1 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el reintento duplicó registros (% conceptos, % puentes)', v_n_conceptos, v_n_puentes;
  END IF;
  IF (v_resultado->>'reintento')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el reintento debía marcarse como tal';
  END IF;
  RAISE NOTICE 'CASO 3 OK: el reintento con la misma clave no duplicó nada';
END;
$caso3$;

ROLLBACK;
