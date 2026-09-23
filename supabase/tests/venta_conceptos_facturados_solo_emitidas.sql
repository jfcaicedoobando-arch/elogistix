-- =============================================================
-- venta_conceptos_facturados_solo_emitidas.sql · P1-1 / P1 moneda
--
-- `validar_cierre_embarque` daba OK en el paso "Todos los conceptos de venta
-- facturados" con facturas en BORRADOR: el concepto pasa a
-- `estado_facturacion='facturado'` en cuanto su proforma queda 'facturada',
-- aunque la factura nunca se haya emitido (caso real ELIMP00008).
--
-- Además, una MISMA proforma se parte en DOS facturas por moneda
-- (construirFacturasAEmitir: una por total_usd y otra por total_mxn). El
-- vínculo debe ser por concepto Y moneda: una factura emitida en otra moneda
-- no acredita al concepto, y una Cancelada no acredita su moneda.
--
--   · CASO 1: USD Borrador + MXN Borrador           → ok=false, sin_emitir=2
--   · CASO 2: USD Emitida + MXN Borrador            → ok=false, sin_emitir=1
--   · CASO 3: ambas Emitidas                        → ok=true
--   · CASO 4: USD Emitida + MXN Cancelada           → ok=false, sin_emitir=1
--   · CASO 5: reemplazo MXN emitido                 → ok=true
--   · CASO 6: segunda proforma con factura Borrador → ok=false
--   · CASO 7: segunda proforma emitida              → ok=true
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/venta_conceptos_facturados_solo_emitidas.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_prof_a uuid;
  v_prof_b uuid;
  v_fac_usd uuid;
  v_fac_mxn uuid;
  v_fac_mxn2 uuid;
  v_fac_b uuid;
  v_check jsonb;
  v_fallo boolean := false;

BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST VENTA FACTURADOS', 'TVF000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'venta-facturados@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- Las facturas USD del fixture pasan por `_factura_tc_dof_obligatorio()`, que
  -- exige el T/C DOF de la fecha de emisión; se siembra con el mismo valor del
  -- fixture (todo se revierte con el ROLLBACK final).
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE, 17, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 17;

  INSERT INTO public.clientes (organization_id, nombre, email)
  VALUES (v_org, 'CLIENTE VENTA FACTURADOS', 'cli-vf@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, cliente_nombre, expediente,
                               modo, tipo, tipo_carga, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', 'ELIMP99201',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          'LCL', 'Confirmado'::public.estado_embarque)
  RETURNING id INTO v_emb;

  -- Proforma A: MIXTA (importes en USD y en MXN) → se factura partida por moneda.
  -- `estado_cliente = 'aceptada'` es obligatorio: sin ello el trigger
  -- enforce_proforma_aceptada_before_factura() bloquea el vínculo a factura.
  INSERT INTO public.proformas (organization_id, embarque_id, cliente_id, cliente_nombre,
                                expediente, numero, estado_proforma, estado_cliente,
                                subtotal_usd, iva_usd, total_usd,
                                subtotal_mxn, iva_mxn, total_mxn)
  VALUES (v_org, v_emb, v_cli, 'CLIENTE VENTA FACTURADOS', 'ELIMP99201',
          'PRO-VF-1', 'facturada', 'aceptada', 50, 8, 58, 100, 16, 116)
  RETURNING id INTO v_prof_a;

  -- Proforma B: una sola factura (MXN).
  INSERT INTO public.proformas (organization_id, embarque_id, cliente_id, cliente_nombre,
                                expediente, numero, estado_proforma, estado_cliente,
                                subtotal_mxn, iva_mxn, total_mxn)
  VALUES (v_org, v_emb, v_cli, 'CLIENTE VENTA FACTURADOS', 'ELIMP99201',
          'PRO-VF-2', 'facturada', 'aceptada', 200, 32, 232)
  RETURNING id INTO v_prof_b;

  -- DOS conceptos activos en la MISMA proforma, uno por moneda.
  INSERT INTO public.conceptos_venta (organization_id, embarque_id, descripcion, cantidad,
                                      precio_unitario, total, moneda, estado_facturacion, proforma_id)
  VALUES (v_org, v_emb, 'Flete MXN', 1, 100, 100, 'MXN'::public.moneda, 'facturado', v_prof_a),
         (v_org, v_emb, 'Flete USD', 1, 50, 50, 'USD'::public.moneda, 'facturado', v_prof_a);

  -- ---------------------------------------------------------------
  -- CASO 1: misma proforma, dos facturas (USD y MXN) en Borrador.
  -- ---------------------------------------------------------------
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, proforma_id, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, v_prof_a, 'BORRADOR-VF-USD', 'ELIMP99201',
          CURRENT_DATE, CURRENT_DATE + 30, 'USD'::public.moneda, 17, 50, 8, 58, 'Borrador')
  RETURNING id INTO v_fac_usd;
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, proforma_id, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, v_prof_a, 'BORRADOR-VF-MXN', 'ELIMP99201',
          CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 100, 16, 116, 'Borrador')
  RETURNING id INTO v_fac_mxn;
  -- Toda factura requiere al menos un concepto para poder emitirse
  -- (congelar_factura_al_emitir → LC_FACTURA_SIN_CONCEPTOS).
  INSERT INTO public.conceptos_factura
    (organization_id, factura_id, descripcion, cantidad, precio_unitario, moneda, total,
     embarque_id, proforma_id_origen)
  VALUES (v_org, v_fac_usd, 'Flete USD', 1, 50, 'USD'::public.moneda, 50, v_emb, v_prof_a),
         (v_org, v_fac_mxn, 'Flete MXN', 1, 100, 'MXN'::public.moneda, 100, v_emb, v_prof_a);

  -- Punteros reales del corte por moneda.
  UPDATE public.proformas
     SET factura_id = v_fac_usd, factura_secundaria_id = v_fac_mxn
   WHERE id = v_prof_a;

  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 1 FALLÓ: con sólo facturas Borrador el check dio OK (%).', v_check;
    v_fallo := true;
  END IF;
  IF (v_check -> 'detalle' ->> 'facturados_sin_emitir')::int <> 2 THEN
    RAISE WARNING 'CASO 1 FALLÓ: facturados_sin_emitir esperado 2, got %.', v_check -> 'detalle';
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 2: sólo la USD emitida; el concepto MXN sigue sin facturar.
  -- ---------------------------------------------------------------
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_usd;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 2 FALLÓ: la factura MXN en Borrador dio OK (%).', v_check;
    v_fallo := true;
  END IF;
  IF (v_check -> 'detalle' ->> 'facturados_sin_emitir')::int <> 1 THEN
    RAISE WARNING 'CASO 2 FALLÓ: facturados_sin_emitir esperado 1, got %.', v_check -> 'detalle';
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 3: ambas emitidas → OK.
  -- ---------------------------------------------------------------
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_mxn;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF NOT (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 3 FALLÓ: ambas facturas emitidas y el check no dio OK (%).', v_check;
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 4: la MXN se cancela → el concepto MXN queda sin factura vigente.
  -- La USD emitida NO acredita a otra moneda (bug original: daba OK).
  -- ---------------------------------------------------------------
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = v_fac_mxn;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 4 FALLÓ: con la MXN Cancelada el concepto MXN dio OK (%).', v_check;
    v_fallo := true;
  END IF;
  IF (v_check -> 'detalle' ->> 'facturados_sin_emitir')::int <> 1 THEN
    RAISE WARNING 'CASO 4 FALLÓ: facturados_sin_emitir esperado 1, got %.', v_check -> 'detalle';
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 5: reemplazo MXN emitido → OK. El índice único
  -- uq_facturas_proforma_moneda_viva impide reusar (proforma_id, MXN), así que
  -- el reemplazo se liga por conceptos_factura.proforma_id_origen (refacturación).
  -- ---------------------------------------------------------------
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, 'VF-MXN-REEMPLAZO', 'ELIMP99201',
          CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 100, 16, 116, 'Borrador')
  RETURNING id INTO v_fac_mxn2;
  INSERT INTO public.conceptos_factura
    (organization_id, factura_id, descripcion, cantidad, precio_unitario, moneda, total,
     embarque_id, proforma_id_origen)
  VALUES (v_org, v_fac_mxn2, 'Flete MXN', 1, 100, 'MXN'::public.moneda, 100, v_emb, v_prof_a);
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_mxn2;


  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF NOT (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 5 FALLÓ: con el reemplazo MXN emitido el check no dio OK (%).', v_check;
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 6: tercer concepto en OTRA proforma, con factura Borrador.
  -- ---------------------------------------------------------------
  INSERT INTO public.conceptos_venta (organization_id, embarque_id, descripcion, cantidad,
                                      precio_unitario, total, moneda, estado_facturacion, proforma_id)
  VALUES (v_org, v_emb, 'Maniobras', 1, 200, 200, 'MXN'::public.moneda, 'facturado', v_prof_b);
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, proforma_id, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, v_prof_b, 'BORRADOR-VF-B', 'ELIMP99201',
          CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 200, 32, 232, 'Borrador')
  RETURNING id INTO v_fac_b;
  INSERT INTO public.conceptos_factura
    (organization_id, factura_id, descripcion, cantidad, precio_unitario, moneda, total,
     embarque_id, proforma_id_origen)
  VALUES (v_org, v_fac_b, 'Maniobras', 1, 200, 'MXN'::public.moneda, 200, v_emb, v_prof_b);
  UPDATE public.proformas SET factura_id = v_fac_b WHERE id = v_prof_b;

  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 6 FALLÓ: proforma B con factura Borrador dio OK (%).', v_check;
    v_fallo := true;
  END IF;
  IF (v_check -> 'detalle' ->> 'facturados_sin_emitir')::int <> 1 THEN
    RAISE WARNING 'CASO 6 FALLÓ: facturados_sin_emitir esperado 1, got %.', v_check -> 'detalle';
    v_fallo := true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASO 7: proforma B emitida → OK global del paso.
  -- ---------------------------------------------------------------
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_b;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF NOT (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 7 FALLÓ: todas las facturas emitidas y el check no dio OK (%).', v_check;
    v_fallo := true;
  END IF;

  IF v_fallo THEN
    RAISE EXCEPTION 'venta_conceptos_facturados_solo_emitidas: al menos un caso falló.';
  END IF;
  RAISE NOTICE 'venta_conceptos_facturados_solo_emitidas: 7 casos OK.';
END $$;

ROLLBACK;
