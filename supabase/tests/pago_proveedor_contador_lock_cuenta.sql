-- =============================================================
-- pago_proveedor_contador_lock_cuenta.sql · Lote MNY (Sentry P0)
--
-- Sentry FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3:
-- `registrar_pago_proveedor_atomico` (SECURITY INVOKER) bloqueaba la cuenta
-- bancaria con `SELECT ... FOR UPDATE`. Un rol `contador` sólo tiene lectura
-- sobre `cuentas_bancarias`, así que el lock devolvía 0 filas y la RPC
-- respondía LC_PAGO_CUENTA_INEXISTENTE sobre una cuenta viva y activa.
--
--   · CASO 1 (positivo): el contador registra el pago con su cuenta activa.
--   · CASO 2 (negativo): cuenta inactiva → LC_PAGO_CUENTA_INACTIVA.
--   · CASO 3 (negativo): cuenta de otra organización → LC_PAGO_CUENTA_OTRA_ORG.
--   · CASO 4 (negativo): cuenta inexistente → LC_PAGO_CUENTA_INEXISTENTE.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/pago_proveedor_contador_lock_cuenta.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org  uuid := 'c1111111-1111-1111-1111-111111111111';
  v_org2 uuid := 'c2222222-2222-2222-2222-222222222222';
  v_uid  uuid := 'c5555555-5555-5555-5555-555555555555';
  v_prov uuid := 'c3333333-3333-3333-3333-333333333333';
  v_cat  uuid := 'c6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org, 'Test Org C Contador'), (v_org2, 'Test Org C Ajena')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'contador-c@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov C', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat C', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- Cuenta propia activa, cuenta propia inactiva y cuenta de otra org.
  INSERT INTO public.cuentas_bancarias (id, organization_id, alias, moneda, activa) VALUES
    ('c7777777-7777-7777-7777-77777777000a', v_org, 'MXN C ACTIVA', 'MXN'::public.moneda, true),
    ('c7777777-7777-7777-7777-77777777000b', v_org, 'MXN C INACTIVA', 'MXN'::public.moneda, false),
    ('c7777777-7777-7777-7777-77777777000c', v_org2, 'MXN C AJENA', 'MXN'::public.moneda, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, subtotal, iva, total,
    estado, estado_aprobacion, fecha_emision
  ) VALUES (
    'cb000000-0000-0000-0000-00000000000a', v_org, v_prov, 'Test Prov C', 'MNY-CTD-01',
    v_cat, 'MXN'::public.moneda, 1000, 0, 1000, 'Vigente', 'aprobada',
    public.fecha_negocio_mx() - 5
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END
$fixture$ LANGUAGE plpgsql;

DO $casos$
DECLARE
  v_pf   uuid := 'cb000000-0000-0000-0000-00000000000a';
  v_ok   uuid := 'c7777777-7777-7777-7777-77777777000a';
  v_off  uuid := 'c7777777-7777-7777-7777-77777777000b';
  v_aj   uuid := 'c7777777-7777-7777-7777-77777777000c';
  v_res  jsonb;
  v_msg  text;
BEGIN
  -- ── CASO 1 · el contador SÍ puede registrar el pago.
  v_res := public.registrar_pago_proveedor_atomico(
    v_pf, public.fecha_negocio_mx(), 100, 'MXN', 'Transferencia', 'MNY-CTD-C1', v_ok);
  IF (v_res->>'pago_id') IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el contador no pudo registrar el pago con cuenta activa';
  END IF;
  RAISE NOTICE 'CASO 1 OK: el contador registró el pago con su cuenta activa';

  -- ── CASO 2 · cuenta inactiva sigue rechazada.
  BEGIN
    v_res := public.registrar_pago_proveedor_atomico(
      v_pf, public.fecha_negocio_mx(), 100, 'MXN', 'Transferencia', 'MNY-CTD-C2', v_off);
    RAISE EXCEPTION 'REGRESION P0: se aceptó una cuenta inactiva';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ 'LC_PAGO_CUENTA_INACTIVA' THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba LC_PAGO_CUENTA_INACTIVA, se obtuvo: %', v_msg;
    END IF;
  END;
  RAISE NOTICE 'CASO 2 OK: cuenta inactiva rechazada';

  -- ── CASO 3 · cuenta de otra organización sigue rechazada.
  BEGIN
    v_res := public.registrar_pago_proveedor_atomico(
      v_pf, public.fecha_negocio_mx(), 100, 'MXN', 'Transferencia', 'MNY-CTD-C3', v_aj);
    RAISE EXCEPTION 'REGRESION P0: se aceptó una cuenta de otra organización';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ 'LC_PAGO_CUENTA_OTRA_ORG' THEN
      RAISE EXCEPTION 'CASO 3 FALLÓ: se esperaba LC_PAGO_CUENTA_OTRA_ORG, se obtuvo: %', v_msg;
    END IF;
  END;
  RAISE NOTICE 'CASO 3 OK: cuenta de otra organización rechazada';

  -- ── CASO 4 · cuenta inexistente sigue rechazada.
  BEGIN
    v_res := public.registrar_pago_proveedor_atomico(
      v_pf, public.fecha_negocio_mx(), 100, 'MXN', 'Transferencia', 'MNY-CTD-C4',
      'c7777777-7777-7777-7777-7777777700ff');
    RAISE EXCEPTION 'REGRESION P0: se aceptó una cuenta inexistente';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg !~ 'LC_PAGO_CUENTA_INEXISTENTE' THEN
      RAISE EXCEPTION 'CASO 4 FALLÓ: se esperaba LC_PAGO_CUENTA_INEXISTENTE, se obtuvo: %', v_msg;
    END IF;
  END;
  RAISE NOTICE 'CASO 4 OK: cuenta inexistente rechazada';
END
$casos$;

ROLLBACK;
