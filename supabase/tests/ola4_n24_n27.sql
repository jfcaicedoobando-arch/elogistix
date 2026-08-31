-- =============================================================
-- ola4_n24_n27.sql · Ola 4 (parches medias/bajas) · N24 y N27
--
-- N24: profit_por_cliente ya no parte al cliente cuando el
-- cliente_nombre difiere entre embarques (GROUP BY sólo cliente_id).
-- N27: provision_organization no crea org huérfana si el owner ya
-- pertenece a otra organización.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_n24_n27.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := 'd1111111-1111-1111-1111-111111111111';
  v_uid uuid := 'd5555555-5555-5555-5555-555555555555';
  v_cli uuid := 'd2222222-2222-2222-2222-222222222222';
  v_emb1 uuid := 'd3333333-3333-3333-3333-333333333333';
  v_emb2 uuid := 'd4444444-4444-4444-4444-444444444444';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org N24 N27')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola4-n24-n27@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;

  -- Mismo cliente_id, cliente_nombre distinto entre embarques.
  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'ACME SA', 'acme@test.local') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, cliente_id, cliente_nombre, expediente, modo, tipo, eta, tipo_cambio_usd)
  VALUES
    (v_emb1, v_org, v_cli, 'ACME SA', 'ELNVA2401', 'Marítimo'::public.modo_transporte,
     'Importación'::public.tipo_operacion, CURRENT_DATE, 18.0),
    (v_emb2, v_org, v_cli, 'Acme S.A.', 'ELNVA2402', 'Marítimo'::public.modo_transporte,
     'Importación'::public.tipo_operacion, CURRENT_DATE, 18.0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, precio_unitario, total, moneda)
  VALUES (v_emb1, v_org, 'Venta 1', 100, 100, 'USD'), (v_emb2, v_org, 'Venta 2', 200, 200, 'USD');

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N24: profit_por_cliente no parte al cliente por cliente_nombre
-- distinto entre embarques (una sola fila, total_embarques=2, venta=300).
-- -------------------------------------------------------------
DO $n24$
DECLARE
  v_filas int; v_venta numeric; v_n bigint;
BEGIN
  SELECT count(*) INTO v_filas
    FROM public.profit_por_cliente() p
   WHERE p.cliente_id = 'd2222222-2222-2222-2222-222222222222';
  IF v_filas <> 1 THEN
    RAISE EXCEPTION 'TEST FAIL: N24 - profit_por_cliente partió al cliente en % filas (esperado 1)', v_filas;
  END IF;

  SELECT p.venta_usd, p.total_embarques INTO v_venta, v_n
    FROM public.profit_por_cliente() p
   WHERE p.cliente_id = 'd2222222-2222-2222-2222-222222222222';
  IF v_venta <> 300 OR v_n <> 2 THEN
    RAISE EXCEPTION 'TEST FAIL: N24 - montos incompletos por el split (venta=%, embarques=% ; esperado 300/2)', v_venta, v_n;
  END IF;
  RAISE NOTICE '✓ N24: profit_por_cliente agrupa por cliente_id (1 fila, venta=300, embarques=2)';
END
$n24$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N27: provision_organization NO crea la org si el owner ya
-- pertenece a otra organización (v_uid ya es miembro de v_org).
-- -------------------------------------------------------------
DO $n27$
DECLARE
  v_count int;
  v_failed boolean := false;
BEGIN
  -- El caller debe ser super_admin de plataforma SIN membresía: user_roles se
  -- sincroniza con organization_members, así que un miembro no puede portar
  -- super_admin. Usamos un usuario de plataforma aparte como caller.
  INSERT INTO auth.users (id, email)
  VALUES ('d6666666-6666-6666-6666-666666666666', 'ola4-n27-sa@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('d6666666-6666-6666-6666-666666666666', 'super_admin')
  ON CONFLICT DO NOTHING;

  -- El RPC valida auth.uid(): simulamos la sesión del super_admin.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'd6666666-6666-6666-6666-666666666666')::text, true);

  BEGIN
    PERFORM public.provision_organization('Org Huerfana N27', NULL, 'd5555555-5555-5555-5555-555555555555');
    v_failed := true; -- si no lanzó excepción, el fix no está aplicado
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_OWNER_YA_ASIGNADO%' THEN
      RAISE EXCEPTION 'TEST FAIL: N27 - excepción inesperada: %', SQLERRM;
    END IF;
  END;

  IF v_failed THEN
    RAISE EXCEPTION 'TEST FAIL: N27 - provision_organization NO lanzó error con owner ya asignado';
  END IF;

  SELECT count(*) INTO v_count FROM public.organizations WHERE nombre = 'Org Huerfana N27';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N27 - se creó una organización huérfana (count=%)', v_count;
  END IF;
  RAISE NOTICE '✓ N27: provision_organization rechaza owner ya asignado sin crear organización huérfana';
END
$n27$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 2 NOTICE "✓ N..." y ROLLBACK. Contra el código
-- pre-fix, N24 falla con >1 fila y N27 falla porque la org sí se crea.
-- =============================================================
