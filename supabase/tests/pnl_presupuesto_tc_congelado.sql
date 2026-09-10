-- =============================================================
-- pnl_presupuesto_tc_congelado.sql · P1 auditoría de negocio 2026-09-10
--
-- Invariante: el presupuesto de `pnl_financiero_embarque`
-- (conceptos_venta / conceptos_costo / seguro) debe usar el tipo de
-- cambio CONGELADO en `embarques.tipo_cambio_usd/eur`, igual que la
-- pestaña Costos. Mover la ETA NO puede cambiar el presupuesto.
--
-- FALLA contra la versión previa (cv/cc derivaban el T/C del DOF de
-- COALESCE(eta, fecha_llegada_real, etd, fecha_creacion)) y PASA tras
-- la migración de este paquete.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/pnl_presupuesto_tc_congelado.sql
-- =============================================================

BEGIN;

DO $test$
DECLARE
  v_org uuid := 'aaaa1111-1111-1111-1111-11111111aaaa';
  v_uid uuid := 'aaaa2222-2222-2222-2222-22222222aaaa';
  v_cli uuid := 'aaaa3333-3333-3333-3333-33333333aaaa';
  v_emb uuid := 'aaaa4444-4444-4444-4444-44444444aaaa';
  v_p1 jsonb; v_p2 jsonb;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org PnL TC') ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'pnl.tc@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'customer_service') ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Cliente PnL TC', 'cliente.pnl.tc@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- DOF deliberadamente distinto al T/C congelado del embarque: si el
  -- presupuesto lo usara, los importes cambiarían al mover la ETA.
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE + 10, 15, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 15;
  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, origen)
  VALUES (CURRENT_DATE + 20, 25, 'manual')
  ON CONFLICT (fecha) DO UPDATE SET usd_mxn = 25;

  INSERT INTO public.embarques
    (id, organization_id, cliente_id, expediente, estado, modo, tipo,
     tipo_cambio_usd, eta)
  VALUES (v_emb, v_org, v_cli, 'ELPNL0001', 'Confirmado',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          20, CURRENT_DATE + 10)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conceptos_venta
    (organization_id, embarque_id, descripcion, cantidad, precio_unitario, total, moneda)
  VALUES (v_org, v_emb, 'Flete marítimo', 1, 100, 100, 'USD'::public.moneda);

  INSERT INTO public.conceptos_costo
    (organization_id, embarque_id, concepto, monto, moneda)
  VALUES (v_org, v_emb, 'Flete naviera', 40, 'USD'::public.moneda);

  PERFORM set_config('request.jwt.claims',
                     jsonb_build_object('sub', v_uid)::text, true);

  v_p1 := public.pnl_financiero_embarque(v_emb);

  IF round((v_p1->'venta'->>'presupuestada_mxn')::numeric, 2) <> 2000.00 THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: venta presupuestada debe ser 100 USD × 20 = 2000, obtuvo %',
      v_p1->'venta'->>'presupuestada_mxn';
  END IF;
  IF round((v_p1->'costo'->>'presupuestado_mxn')::numeric, 2) <> 800.00 THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: costo presupuestado debe ser 40 USD × 20 = 800, obtuvo %',
      v_p1->'costo'->>'presupuestado_mxn';
  END IF;

  -- Mover la ETA a una fecha con DOF distinto no debe alterar el presupuesto.
  UPDATE public.embarques SET eta = CURRENT_DATE + 20 WHERE id = v_emb;

  v_p2 := public.pnl_financiero_embarque(v_emb);

  IF (v_p2->'venta'->>'presupuestada_mxn')::numeric
       IS DISTINCT FROM (v_p1->'venta'->>'presupuestada_mxn')::numeric
     OR (v_p2->'costo'->>'presupuestado_mxn')::numeric
       IS DISTINCT FROM (v_p1->'costo'->>'presupuestado_mxn')::numeric THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el presupuesto cambió al mover la ETA (% → %)',
      v_p1->'venta'->>'presupuestada_mxn', v_p2->'venta'->>'presupuestada_mxn';
  END IF;
END
$test$;

ROLLBACK;
