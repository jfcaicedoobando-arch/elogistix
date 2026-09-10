-- =============================================================
-- proforma_conversion_requiere_aceptacion.sql · P1 integridad 2026-09-10
--
-- Invariante: `convertir_proformas_a_factura` sólo puede facturar
-- proformas con `estado_cliente = 'aceptada'`. La UI ya ocultaba la
-- acción para pendiente/rechazada, pero la RPC podía llamarse directo
-- y saltarse la aceptación del cliente.
--
-- FALLA contra la versión previa (pendiente/rechazada facturaban) y
-- PASA tras la migración v13.823.279.
--
-- Fixture en BEGIN…ROLLBACK: no ensucia el snapshot.
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/proforma_conversion_requiere_aceptacion.sql
-- =============================================================

BEGIN;

DO $fixture$
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES ('cccc1111-1111-1111-1111-11111111cccc', 'Test Org Conversion Proforma')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email)
  VALUES ('cccc2222-2222-2222-2222-22222222cccc', 'conv.proforma@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- Rol financiero: la RPC exige `es_escritor_financiero`.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES ('cccc1111-1111-1111-1111-11111111cccc',
          'cccc2222-2222-2222-2222-22222222cccc', 'contador')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('cccc2222-2222-2222-2222-22222222cccc', 'contador'::public.app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email, rfc)
  VALUES ('cccc3333-3333-3333-3333-33333333cccc',
          'cccc1111-1111-1111-1111-11111111cccc',
          'Cliente Conversion', 'cliente.conv@test.mx', 'XAXX010101000')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.factura_series (id, organization_id, codigo, prefijo)
  VALUES ('cccc7777-7777-7777-7777-77777777cccc',
          'cccc1111-1111-1111-1111-11111111cccc', 'TEST', 'T')
  ON CONFLICT (id) DO NOTHING;

  -- `conceptos_venta.embarque_id` es NOT NULL: los conceptos siempre
  -- cuelgan de un embarque real.
  INSERT INTO public.embarques
    (id, organization_id, cliente_id, expediente, estado, modo, tipo)
  VALUES ('cccc8888-8888-8888-8888-88888888cccc',
          'cccc1111-1111-1111-1111-11111111cccc',
          'cccc3333-3333-3333-3333-33333333cccc',
          'ELCNV0001', 'Confirmado',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- Tres proformas del mismo cliente/organización/embarque, con un
  -- concepto de venta MXN cada una. Sólo cambia `estado_cliente`.
  INSERT INTO public.proformas
    (id, organization_id, numero, cliente_id, cliente_nombre, expediente,
     embarque_id, estado_cliente, subtotal_mxn, iva_mxn, total_mxn)
  VALUES
    ('cccc4444-4444-4444-4444-44444444cccc', 'cccc1111-1111-1111-1111-11111111cccc',
     'PRO-TEST-PEND', 'cccc3333-3333-3333-3333-33333333cccc', 'Cliente Conversion',
     'ELCNV0001', 'cccc8888-8888-8888-8888-88888888cccc', 'pendiente', 1000, 160, 1160),
    ('cccc5555-5555-5555-5555-55555555cccc', 'cccc1111-1111-1111-1111-11111111cccc',
     'PRO-TEST-RECH', 'cccc3333-3333-3333-3333-33333333cccc', 'Cliente Conversion',
     'ELCNV0001', 'cccc8888-8888-8888-8888-88888888cccc', 'rechazada', 1000, 160, 1160),
    ('cccc6666-6666-6666-6666-66666666cccc', 'cccc1111-1111-1111-1111-11111111cccc',
     'PRO-TEST-ACEP', 'cccc3333-3333-3333-3333-33333333cccc', 'Cliente Conversion',
     'ELCNV0001', 'cccc8888-8888-8888-8888-88888888cccc', 'aceptada', 1000, 160, 1160);

  INSERT INTO public.conceptos_venta
    (organization_id, embarque_id, proforma_id, descripcion, cantidad,
     precio_unitario, total, moneda, aplica_iva, tasa_iva_aplicada)
  SELECT 'cccc1111-1111-1111-1111-11111111cccc',
         'cccc8888-8888-8888-8888-88888888cccc', p, 'Flete', 1, 1000, 1000,
         'MXN'::public.moneda, true, 0.16
  FROM unnest(ARRAY[
    'cccc4444-4444-4444-4444-44444444cccc'::uuid,
    'cccc5555-5555-5555-5555-55555555cccc'::uuid,
    'cccc6666-6666-6666-6666-66666666cccc'::uuid
  ]) AS p;

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'cccc2222-2222-2222-2222-22222222cccc')::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1 y 2: pendiente y rechazada deben rechazarse sin facturar.
-- -------------------------------------------------------------
DO $rechazos$
DECLARE
  v_id uuid;
  v_msg text;
  v_estado text;
BEGIN
  FOREACH v_id IN ARRAY ARRAY[
    'cccc4444-4444-4444-4444-44444444cccc'::uuid,  -- pendiente
    'cccc5555-5555-5555-5555-55555555cccc'::uuid   -- rechazada
  ] LOOP
    v_msg := NULL;
    BEGIN
      PERFORM public.convertir_proformas_a_factura(
        ARRAY[v_id], 'cccc7777-7777-7777-7777-77777777cccc'::uuid,
        'PUE', '03', 'G03', 0, NULL, NULL
      );
    EXCEPTION WHEN OTHERS THEN
      v_msg := SQLERRM;
    END;

    IF v_msg IS NULL OR v_msg NOT LIKE 'LC_PROFORMA_REQUIERE_ACEPTACION%' THEN
      RAISE EXCEPTION 'LC_TEST_FALLA: la proforma % debió rechazarse con LC_PROFORMA_REQUIERE_ACEPTACION, mensaje: %',
        v_id, COALESCE(v_msg, '(sin error)');
    END IF;

    SELECT estado_proforma INTO v_estado FROM public.proformas WHERE id = v_id;
    IF v_estado = 'facturada' THEN
      RAISE EXCEPTION 'LC_TEST_FALLA: la proforma % quedó facturada pese al rechazo', v_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.facturas
      WHERE proforma_id = v_id AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_TEST_FALLA: se creó una factura para la proforma % no aceptada', v_id;
    END IF;
  END LOOP;
END
$rechazos$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: aceptada sigue facturando con normalidad.
-- -------------------------------------------------------------
DO $aceptada$
DECLARE
  v_facturas int;
  v_estado text;
BEGIN
  PERFORM public.convertir_proformas_a_factura(
    ARRAY['cccc6666-6666-6666-6666-66666666cccc'::uuid],
    'cccc7777-7777-7777-7777-77777777cccc'::uuid,
    'PUE', '03', 'G03', 0, NULL, NULL
  );

  SELECT count(*) INTO v_facturas FROM public.facturas
   WHERE proforma_id = 'cccc6666-6666-6666-6666-66666666cccc' AND deleted_at IS NULL;
  IF v_facturas <> 1 THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: la proforma aceptada debió generar 1 factura, generó %', v_facturas;
  END IF;

  SELECT estado_proforma INTO v_estado FROM public.proformas
   WHERE id = 'cccc6666-6666-6666-6666-66666666cccc';
  IF v_estado <> 'facturada' THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: la proforma aceptada quedó en estado %', v_estado;
  END IF;
END
$aceptada$ LANGUAGE plpgsql;

ROLLBACK;
