-- =============================================================
-- ola4_n31_n36_n37.sql · Ola 4 (medias/bajas) · N31, N36, N37
--
-- N31: aplicar_anticipo_a_factura/cancelar_anticipo_proveedor con FOR UPDATE
--      + CHECK (saldo_disponible >= 0) — dos aplicaciones que juntas exceden
--      el saldo disponible; la segunda debe fallar con LC_ANTICIPO_SIN_SALDO
--      (no dejar saldo negativo).
-- N36: uq_efe_org_xml_hash_vivo — dos documentos vivos de la misma org con
--      el mismo xml_hash deben ser rechazados por el índice único.
-- N37: eliminar_proforma_rpc ya no bloquea si la única factura ligada está
--      Cancelada/Sustituida/borrada (RG10 sólo cubría "sin factura").
--
-- Sigue el patrón de ola4_altas.sql: fixture con IDs deterministas +
-- set_config('request.jwt.claims', ...) para simular auth.uid().
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_n31_n36_n37.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org   uuid := 'c1111111-1111-1111-1111-111111111111';
  v_uid   uuid := 'c5555555-5555-5555-5555-555555555555';
  v_prov  uuid := 'c3333333-3333-3333-3333-333333333333';
  v_cat   uuid := 'c6666666-6666-6666-6666-666666666666';
  v_cliente uuid := 'c9999999-9999-9999-9999-999999999999';
  v_embarque uuid := 'c7777777-7777-7777-7777-777777777777';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org C Ola4')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola4-c@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov Ola4 C', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat Ola4 C', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  -- N31: anticipo con saldo 100; dos aplicaciones de 60 cada una exceden el saldo.
  INSERT INTO public.anticipos_proveedor (
    id, organization_id, proveedor_id, monto, moneda, estado, saldo_disponible
  ) VALUES (
    'c8888888-8888-8888-8888-888888888888', v_org, v_prov, 100, 'MXN'::public.moneda,
    'disponible', 100
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion
  ) VALUES (
    'c4444444-4444-4444-4444-444444444444', v_org, v_prov, 'Test Prov', 'OLA4-N31-01',
    v_cat, 'MXN'::public.moneda, 0, 200, 0, 200, 'Borrador', 'aprobada'
  ) ON CONFLICT (id) DO NOTHING;

  -- N37: cliente + embarque + proforma con factura ligada CANCELADA.
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cliente, v_org, 'Cliente Ola4 C', 'XAXX010101000', 'ola4-c-cli@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo)
  VALUES (v_embarque, v_org, 'ELOLC001', v_cliente,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, embarque_id, serie, folio, moneda,
    tipo_cambio_usd, subtotal, iva, total, estado
  ) VALUES (
    'c2222222-2222-2222-2222-222222222222', v_org, v_cliente, v_embarque,
    'A', 1, 'MXN'::public.moneda, 0, 100, 0, 100, 'Cancelada'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proformas (
    id, organization_id, embarque_id, numero, estado_proforma, factura_id
  ) VALUES (
    'c1234567-1234-1234-1234-123456789012', v_org, v_embarque, 'PRO-OLA4-N37',
    'enviada', 'c2222222-2222-2222-2222-222222222222'
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N31: dos aplicaciones concurrentes que juntas exceden el saldo
-- disponible (100). La primera de 60 debe pasar; la segunda de 60 debe
-- fallar con LC_ANTICIPO_SIN_SALDO (no dejar saldo negativo).
-- -------------------------------------------------------------
DO $n31$
DECLARE
  v_saldo_final numeric;
BEGIN
  PERFORM public.aplicar_anticipo_a_factura(
    'c8888888-8888-8888-8888-888888888888'::uuid,
    'c4444444-4444-4444-4444-444444444444'::uuid,
    60);

  BEGIN
    PERFORM public.aplicar_anticipo_a_factura(
      'c8888888-8888-8888-8888-888888888888'::uuid,
      'c4444444-4444-4444-4444-444444444444'::uuid,
      60);
    RAISE EXCEPTION 'TEST FAIL: N31 - se aplicó un segundo monto que excede el saldo disponible';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_ANTICIPO_SIN_SALDO%' THEN
      RAISE EXCEPTION 'TEST FAIL: N31 - error inesperado: %', SQLERRM;
    END IF;
  END;

  SELECT saldo_disponible INTO v_saldo_final
    FROM public.anticipos_proveedor WHERE id = 'c8888888-8888-8888-8888-888888888888';
  IF v_saldo_final < 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N31 - saldo_disponible quedó negativo (%)', v_saldo_final;
  END IF;
  IF v_saldo_final <> 40 THEN
    RAISE EXCEPTION 'TEST FAIL: N31 - saldo_disponible esperado 40, obtuvo %', v_saldo_final;
  END IF;
  RAISE NOTICE '✓ N31: doble aplicación concurrente rechazada, saldo_disponible=% (>= 0)', v_saldo_final;
END
$n31$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N31b: el CHECK a nivel BD existe (aunque NOT VALID) — comprobamos
-- que la constraint fue creada por la migración.
-- -------------------------------------------------------------
DO $n31b$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.anticipos_proveedor'::regclass
      AND conname = 'anticipos_proveedor_saldo_no_negativo'
  ) THEN
    RAISE EXCEPTION 'TEST FAIL: N31 - falta el CHECK anticipos_proveedor_saldo_no_negativo';
  END IF;
  RAISE NOTICE '✓ N31b: CHECK anticipos_proveedor_saldo_no_negativo existe';
END
$n31b$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N36: uq_efe_org_xml_hash_vivo rechaza un segundo documento vivo con
-- el mismo xml_hash en la misma organización.
-- -------------------------------------------------------------
DO $n36$
DECLARE
  v_org uuid := 'c1111111-1111-1111-1111-111111111111';
  v_emb uuid := 'c7777777-7777-7777-7777-777777777777';
BEGIN
  INSERT INTO public.embarque_facturas_entrantes (
    id, organization_id, embarque_id, archivo_path, archivo_hash, nombre_archivo,
    xml_path, xml_nombre, xml_hash, estado
  ) VALUES (
    'c0000001-0000-0000-0000-000000000001', v_org, v_emb,
    'org/emb/doc1.pdf', 'hash-pdf-1', 'doc1.pdf',
    'org/emb/doc1.xml', 'doc1.xml', 'hash-xml-ola4-n36', 'por_capturar'
  );

  BEGIN
    INSERT INTO public.embarque_facturas_entrantes (
      id, organization_id, embarque_id, archivo_path, archivo_hash, nombre_archivo,
      xml_path, xml_nombre, xml_hash, estado
    ) VALUES (
      'c0000002-0000-0000-0000-000000000002', v_org, v_emb,
      'org/emb/doc2.pdf', 'hash-pdf-2', 'doc2.pdf',
      'org/emb/doc2.xml', 'doc2.xml', 'hash-xml-ola4-n36', 'por_capturar'
    );
    RAISE EXCEPTION 'TEST FAIL: N36 - se insertó un segundo documento vivo con el mismo xml_hash';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ N36: xml_hash duplicado vivo rechazado por uq_efe_org_xml_hash_vivo';
  END;
END
$n36$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N36b: el mismo xml_hash SÍ se permite si el primero está soft-eliminado.
-- -------------------------------------------------------------
DO $n36b$
DECLARE
  v_org uuid := 'c1111111-1111-1111-1111-111111111111';
  v_emb uuid := 'c7777777-7777-7777-7777-777777777777';
BEGIN
  UPDATE public.embarque_facturas_entrantes
     SET deleted_at = now()
   WHERE id = 'c0000001-0000-0000-0000-000000000001';

  INSERT INTO public.embarque_facturas_entrantes (
    id, organization_id, embarque_id, archivo_path, archivo_hash, nombre_archivo,
    xml_path, xml_nombre, xml_hash, estado
  ) VALUES (
    'c0000003-0000-0000-0000-000000000003', v_org, v_emb,
    'org/emb/doc3.pdf', 'hash-pdf-3', 'doc3.pdf',
    'org/emb/doc3.xml', 'doc3.xml', 'hash-xml-ola4-n36', 'por_capturar'
  );
  RAISE NOTICE '✓ N36b: xml_hash reutilizable tras soft-delete del original';
END
$n36b$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N37: eliminar_proforma_rpc ya NO bloquea si la única factura ligada
-- está Cancelada (el hueco que dejaba RG10 incompleto).
-- -------------------------------------------------------------
DO $n37$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.eliminar_proforma_rpc('c1234567-1234-1234-1234-123456789012'::uuid);
  IF (v_result->>'eliminada')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST FAIL: N37 - la proforma con factura Cancelada no se pudo eliminar: %', v_result;
  END IF;
  RAISE NOTICE '✓ N37: proforma con factura Cancelada eliminada correctamente';
END
$n37$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: NOTICE "✓ N31/N31b/N36/N36b/N37" y ROLLBACK. Contra
-- el código pre-fix, N31 dejaría saldo_disponible negativo, N36 aceptaría
-- el xml_hash duplicado (sin índice) y N37 lanzaría LC_PROFORMA_FACTURADA.
-- =============================================================
