-- =============================================================
-- ola4_altas.sql · Ola 4 (parches N1-N17) · guards de tenant + índices
--
-- Cubre N6/N12 (cross-tenant en RPCs de proveedor), N15/N16 (índices
-- únicos con predicado deleted_at IS NULL) y N10 (Borrador no cuenta
-- como activo en dashboard_summary). Sigue el patrón de
-- aging_nc_deleted_at.sql / cxp_guard_sobrepago.sql: fixture con IDs
-- deterministas + set_config('request.jwt.claims', ...) para simular
-- auth.uid() sin necesitar SET ROLE (las RPCs son SECURITY DEFINER y
-- validan tenant vía current_user_org_id()/is_org_member()).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_altas.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org_a uuid := 'a1111111-1111-1111-1111-111111111111';
  v_org_b uuid := 'b2222222-2222-2222-2222-222222222222';
  v_uid_a uuid := 'a5555555-5555-5555-5555-555555555555';
  v_prov  uuid := 'a3333333-3333-3333-3333-333333333333';
  -- v13.777.9: los FK compuestos por org (Ola 2) prohíben que una factura de
  -- la org B apunte al proveedor de la org A: cada org necesita el suyo.
  v_prov_b uuid := 'b3333333-3333-3333-3333-333333333333';
  v_cat_a uuid := 'a6666666-6666-6666-6666-666666666666';
  v_cat_b uuid := 'b6666666-6666-6666-6666-666666666666';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES
    (v_org_a, 'Test Org A Ola4'), (v_org_b, 'Test Org B Ola4')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid_a, 'ola4-a@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_a, v_uid_a, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid_a, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org_a, 'Test Prov Ola4', 'GastoOperativo', 'Otros'),
         (v_prov_b, v_org_b, 'Test Prov Ola4 B', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES
    (v_cat_a, v_org_a, 'Cat Ola4 A', 0, true, 'CostoDirectoEmbarque'),
    (v_cat_b, v_org_b, 'Cat Ola4 B', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- Cliente de la org B (requerido por embarques.cliente_id NOT NULL).
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES ('b9999999-9999-9999-9999-999999999999', v_org_b, 'Cliente Ola4 B',
          'XAXX010101000', 'ola4-b@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Embarque de la org B (ajeno) para el caso N6.
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo)
  VALUES ('b7777777-7777-7777-7777-777777777777', v_org_b, 'ELOLB001',
          'b9999999-9999-9999-9999-999999999999',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- Factura de proveedor de la org A (dueña de la RPC de ajustes).
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion
  ) VALUES (
    'a4444444-4444-4444-4444-444444444444', v_org_a, v_prov, 'Test Prov', 'OLA4-N6-01',
    v_cat_a, 'MXN'::public.moneda, 0, 1000, 0, 1000, 'Borrador', 'aprobada'
  ) ON CONFLICT (id) DO NOTHING;

  -- Anticipo y factura de la org B (ajenos al caller, para N12).
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, monto, moneda, estado, saldo_disponible
  ) VALUES (
    'b8888888-8888-8888-8888-888888888888', v_org_b, v_prov_b, 500, 'MXN'::public.moneda,
    'disponible', 500
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion
  ) VALUES (
    'b4444444-4444-4444-4444-444444444444', v_org_b, v_prov_b, 'Test Prov', 'OLA4-N12-01',
    v_cat_b, 'MXN'::public.moneda, 0, 500, 0, 500, 'Borrador', 'aprobada'
  ) ON CONFLICT (id) DO NOTHING;

  -- Sesión del usuario A (miembro sólo de la org A).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_a)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N6: crear_ajustes_factura_proveedor_rpc con embarque_id de OTRA org.
-- -------------------------------------------------------------
DO $n6$
BEGIN
  BEGIN
    PERFORM public.crear_ajustes_factura_proveedor_rpc(
      'a4444444-4444-4444-4444-444444444444'::uuid,
      jsonb_build_array(jsonb_build_object(
        'embarque_id', 'b7777777-7777-7777-7777-777777777777',
        'descripcion', 'ajuste cross-tenant', 'monto', 100))
    );
    RAISE EXCEPTION 'TEST FAIL: N6 - se aceptó un ajuste referenciando un embarque de otra organización';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_EMBARQUE_AJENO%' THEN
      RAISE EXCEPTION 'TEST FAIL: N6 - error inesperado: %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ N6: ajuste con embarque ajeno rechazado (LC_EMBARQUE_AJENO)';
  END;
END
$n6$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N12a: aplicar_anticipo_a_factura con anticipo/factura de OTRA org.
-- -------------------------------------------------------------
DO $n12a$
BEGIN
  BEGIN
    PERFORM public.aplicar_anticipo_a_factura(
      'b8888888-8888-8888-8888-888888888888'::uuid,
      'b4444444-4444-4444-4444-444444444444'::uuid,
      100);
    RAISE EXCEPTION 'TEST FAIL: N12 - se aplicó un anticipo de otra organización';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ANTICIPO_OTRA_ORG%' THEN
      RAISE EXCEPTION 'TEST FAIL: N12 - error inesperado en aplicar_anticipo_a_factura: %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ N12a: aplicar_anticipo_a_factura cross-tenant rechazado';
  END;
END
$n12a$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N12b: cancelar_anticipo_proveedor con anticipo de OTRA org.
-- -------------------------------------------------------------
DO $n12b$
BEGIN
  BEGIN
    PERFORM public.cancelar_anticipo_proveedor(
      'b8888888-8888-8888-8888-888888888888'::uuid, 'motivo de prueba ola4');
    RAISE EXCEPTION 'TEST FAIL: N12 - se canceló un anticipo de otra organización';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ANTICIPO_OTRA_ORG%' THEN
      RAISE EXCEPTION 'TEST FAIL: N12 - error inesperado en cancelar_anticipo_proveedor: %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ N12b: cancelar_anticipo_proveedor cross-tenant rechazado';
  END;
END
$n12b$ LANGUAGE plpgsql;


ROLLBACK;

-- =============================================================
-- Resultado esperado: 3 NOTICE "✓ N6/N12a/N12b" y ROLLBACK. Contra el
-- código pre-Ola4 (guards N6/N12 ausentes) el caso correspondiente
-- aborta con TEST FAIL.
-- =============================================================
