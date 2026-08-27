-- =============================================================
-- ola1_guards_c6_c7_c8.sql · Ola 1 remediación (auditoría 3)
--
-- C6 — el DELETE físico de facturas está prohibido (trigger + revoke).
-- C7 — `ensure_demo_membership` no es ejecutable por `authenticated`.
-- C8 — `uuid_fiscal` es único por organización en facturas vivas.
-- C9 — los RPC del dashboard exigen rol de dirección.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola1_guards_c6_c7_c8.sql
-- =============================================================

BEGIN;

-- C7 · ACL de la función demo -------------------------------------------------
DO $c7$
BEGIN
  IF has_function_privilege('authenticated',
       'public.ensure_demo_membership(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'OLA1 C7 FALLA: ensure_demo_membership sigue ejecutable por authenticated';
  END IF;
  IF has_function_privilege('anon',
       'public.ensure_demo_membership(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'OLA1 C7 FALLA: ensure_demo_membership es ejecutable por anon';
  END IF;
  RAISE NOTICE 'C7 OK: ensure_demo_membership sólo service_role';
END
$c7$;

-- C6 · privilegios y política de DELETE --------------------------------------
DO $c6acl$
BEGIN
  IF has_table_privilege('authenticated', 'public.facturas', 'DELETE') THEN
    RAISE EXCEPTION 'OLA1 C6 FALLA: authenticated conserva DELETE sobre facturas';
  END IF;
  IF has_table_privilege('anon', 'public.facturas', 'DELETE') THEN
    RAISE EXCEPTION 'OLA1 C6 FALLA: anon conserva DELETE sobre facturas';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
     WHERE polrelid = 'public.facturas'::regclass AND polcmd = 'd'
  ) THEN
    RAISE EXCEPTION 'OLA1 C6 FALLA: existe una policy de DELETE en facturas';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.facturas'::regclass
       AND tgname = 'trg_prohibir_delete_factura'
  ) THEN
    RAISE EXCEPTION 'OLA1 C6 FALLA: falta el trigger que prohíbe el DELETE físico';
  END IF;
  RAISE NOTICE 'C6 OK: sin DELETE de facturas (privilegios, policy y trigger)';
END
$c6acl$;

-- C6/C8 · comportamiento con datos -------------------------------------------
DO $fixture$
DECLARE
  v_org uuid := '1b111111-1111-1111-1111-1111111110b1';
  v_cli uuid := '1b222222-2222-2222-2222-2222222220b1';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Ola1 Guards') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Ola1 Guards', 'XAXX010101000', 'ola1g@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
     subtotal, iva, total, estado, uuid_fiscal)
  VALUES
    ('1b333333-3333-3333-3333-3333333330b1', v_org, v_cli, 'Test Cli Ola1 Guards',
     'OLA1-G-001', CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1,
     100, 16, 116, 'Emitida'::public.estado_factura, 'OLA1-UUID-DUP');
END
$fixture$;

DO $c6$
BEGIN
  BEGIN
    DELETE FROM public.facturas WHERE id = '1b333333-3333-3333-3333-3333333330b1';
    RAISE EXCEPTION 'OLA1 C6 FALLA: el DELETE físico de la factura fue permitido';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'C6 OK: DELETE físico rechazado (LC_FACTURA_DELETE_PROHIBIDO)';
  END;
END
$c6$;

DO $c8$
BEGIN
  BEGIN
    INSERT INTO public.facturas
      (id, organization_id, cliente_id, cliente_nombre, numero,
       fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
       subtotal, iva, total, estado, uuid_fiscal)
    VALUES
      ('1b444444-4444-4444-4444-4444444440b1', '1b111111-1111-1111-1111-1111111110b1',
       '1b222222-2222-2222-2222-2222222220b1', 'Test Cli Ola1 Guards',
       'OLA1-G-002', CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1,
       100, 16, 116, 'Emitida'::public.estado_factura, 'OLA1-UUID-DUP');
    RAISE EXCEPTION 'OLA1 C8 FALLA: se aceptó un uuid_fiscal duplicado en la misma organización';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'C8 OK: uuid_fiscal duplicado rechazado por índice único';
  END;
END
$c8$;

-- C9 · guard de rol en el dashboard ------------------------------------------
DO $c9$
BEGIN
  IF has_function_privilege('authenticated',
       'public._dashboard_summary_calc()', 'EXECUTE') THEN
    RAISE EXCEPTION 'OLA1 C9 FALLA: el cálculo interno del dashboard sigue expuesto a authenticated';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.dashboard_summary()', 'EXECUTE') THEN
    RAISE EXCEPTION 'OLA1 C9 FALLA: el wrapper dashboard_summary no es ejecutable por authenticated';
  END IF;
  RAISE NOTICE 'C9 OK: dashboard con wrapper y candado de rol';
END
$c9$;

ROLLBACK;
