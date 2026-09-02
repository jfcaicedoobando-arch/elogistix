-- =============================================================
-- defecto5_lock_nc_saldo.sql · Auditoría 2026-09-10 (Defecto 5, P1)
--
-- `assert_nc_no_excede_saldo()` ahora bloquea la factura con
-- `SELECT ... FOR UPDATE` antes de recalcular saldo/NC previas, para
-- serializar NC concurrentes de la misma factura y evitar sobreacreditar.
--
-- Un runner de una sola sesión no puede reproducir la carrera real
-- (dos transacciones concurrentes bloqueadas por el mismo FOR UPDATE), así
-- que este test verifica, en orden serializado dentro de una sola sesión:
--   1) El candado (`FOR UPDATE`) existe en la definición de la función.
--   2) Con saldo 100: la primera NC de 80 se aplica; la segunda NC de 80
--      (que por sí sola cabría en el saldo original) falla con
--      LC_NC_EXCEDE_SALDO porque ya se contabilizó la primera.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/defecto5_lock_nc_saldo.sql
-- =============================================================

BEGIN;

-- 1) El candado existe en el cuerpo de la función.
DO $chk_lock$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'assert_nc_no_excede_saldo';

  IF v_src NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'DEFECTO 5 FALLÓ: assert_nc_no_excede_saldo() ya no bloquea la factura (FOR UPDATE ausente)';
  END IF;
  RAISE NOTICE 'CHK LOCK OK: assert_nc_no_excede_saldo() bloquea la factura con FOR UPDATE';
END
$chk_lock$;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111151';
  v_cli uuid := '22222222-2222-2222-2222-222222222251';
  v_fac uuid := '33333333-3333-3333-3333-333333333351';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Defecto5') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Defecto5', 'XAXX010101000', 'd5@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas
    (id, organization_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio,
     subtotal, iva, total, estado)
  VALUES
    (v_fac, v_org, v_cli, 'Test Cli Defecto5', 'NC-D5-001',
     CURRENT_DATE - 5, CURRENT_DATE + 25, 'MXN'::public.moneda, 1,
     100, 0, 100, 'Emitida'::public.estado_factura);
END
$fixture$;

-- 2) Primera NC de 80 sobre saldo 100 → se aplica.
DO $nc1$
BEGIN
  INSERT INTO public.factura_notas_credito
    (id, organization_id, factura_id, folio, monto, moneda, tipo_cambio,
     fecha_emision, estado, uuid_fiscal)
  VALUES
    ('44444444-4444-4444-4444-444444444451', '11111111-1111-1111-1111-111111111151',
     '33333333-3333-3333-3333-333333333351', 'NC-D5-T1', 80, 'MXN'::public.moneda, 1,
     CURRENT_DATE, 'Aplicada'::public.estado_nota_credito, gen_random_uuid()::text);
  RAISE NOTICE 'NC1 OK: primera NC de 80 aplicada sobre saldo 100';
END
$nc1$;

-- Segunda NC de 80 (serializada tras la primera): el saldo restante es 20,
-- así que debe rechazarse con LC_NC_EXCEDE_SALDO. Esto es lo que el lock
-- evita que se rompa si dos sesiones concurrentes leyeran el saldo "viejo"
-- (100) en paralelo sin bloquearse entre sí.
DO $nc2$
BEGIN
  BEGIN
    INSERT INTO public.factura_notas_credito
      (id, organization_id, factura_id, folio, monto, moneda, tipo_cambio,
       fecha_emision, estado, uuid_fiscal)
    VALUES
      ('44444444-4444-4444-4444-444444444452', '11111111-1111-1111-1111-111111111151',
       '33333333-3333-3333-3333-333333333351', 'NC-D5-T2', 80, 'MXN'::public.moneda, 1,
       CURRENT_DATE, 'Aplicada'::public.estado_nota_credito, gen_random_uuid()::text);
    RAISE EXCEPTION 'DEFECTO 5 FALLÓ: se sobreacreditó la factura (dos NC de 80 sobre saldo 100)';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%LC_NC_EXCEDE_SALDO%' THEN
        RAISE EXCEPTION 'CASO FALLÓ: error inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'NC2 OK: LC_NC_EXCEDE_SALDO — sólo una de las dos NC de 80 quedó aplicada';
  END;
END
$nc2$;

ROLLBACK;
