-- =============================================================
-- proforma_iva_overrides_seleccion.sql · P1/P2 integridad 2026-09-10
--
-- Invariante: en `crear_proforma_atomica`, un ajuste de IVA
-- (p_iva_overrides) sólo puede tocar conceptos incluidos en
-- p_concepto_ids. Antes el UPDATE no filtraba por la selección y
-- podía cambiar aplica_iva de OTROS conceptos del mismo embarque,
-- contaminando proformas posteriores.
--
-- FALLA contra la versión previa (el override ajeno se aplicaba en
-- silencio) y PASA tras la migración de este paquete.
--
-- Fixture en BEGIN…ROLLBACK: no ensucia el snapshot.
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/proforma_iva_overrides_seleccion.sql
-- =============================================================

BEGIN;

DO $fixture$
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES ('bbbb1111-1111-1111-1111-11111111bbbb', 'Test Org IVA Overrides')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email)
  VALUES ('bbbb2222-2222-2222-2222-22222222bbbb', 'iva.overrides@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES ('bbbb1111-1111-1111-1111-11111111bbbb',
          'bbbb2222-2222-2222-2222-22222222bbbb', 'customer_service')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES ('bbbb3333-3333-3333-3333-33333333bbbb',
          'bbbb1111-1111-1111-1111-11111111bbbb',
          'Cliente IVA Overrides', 'cliente.iva.ovr@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques
    (id, organization_id, cliente_id, expediente, estado, modo, tipo)
  VALUES ('bbbb4444-4444-4444-4444-44444444bbbb',
          'bbbb1111-1111-1111-1111-11111111bbbb',
          'bbbb3333-3333-3333-3333-33333333bbbb',
          'ELOVR0001', 'Confirmado',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- Dos conceptos del mismo embarque, ambos con IVA.
  INSERT INTO public.conceptos_venta
    (id, organization_id, embarque_id, descripcion, cantidad,
     precio_unitario, total, moneda, aplica_iva, tasa_iva_aplicada)
  VALUES
    ('bbbb5555-5555-5555-5555-55555555bbbb',
     'bbbb1111-1111-1111-1111-11111111bbbb',
     'bbbb4444-4444-4444-4444-44444444bbbb',
     'Flete seleccionado', 1, 1000, 1000, 'MXN'::public.moneda, true, 0.16),
    ('bbbb6666-6666-6666-6666-66666666bbbb',
     'bbbb1111-1111-1111-1111-11111111bbbb',
     'bbbb4444-4444-4444-4444-44444444bbbb',
     'Maniobras NO seleccionado', 1, 500, 500, 'MXN'::public.moneda, true, 0.16);

  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'bbbb2222-2222-2222-2222-22222222bbbb')::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: override apuntando al concepto NO seleccionado debe
-- rechazarse con error claro y sin persistir nada (atómico).
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_msg text;
  v_aplica boolean;
  v_estado text;
BEGIN
  BEGIN
    PERFORM public.crear_proforma_atomica(
      'bbbb1111-1111-1111-1111-11111111bbbb',
      'bbbb4444-4444-4444-4444-44444444bbbb',
      'bbbb3333-3333-3333-3333-33333333bbbb',
      'Cliente IVA Overrides', 'ELOVR0001', NULL,
      ARRAY['bbbb5555-5555-5555-5555-55555555bbbb'::uuid],
      0, 0, 0, 1000, 160, 1160,
      NULL, 'tester', 30, 0.16,
      jsonb_build_object('bbbb6666-6666-6666-6666-66666666bbbb', false)
    );
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;

  IF v_msg IS NULL OR v_msg NOT LIKE 'LC_OVERRIDE_FUERA_DE_SELECCION%' THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el override fuera de la selección debió rechazarse con LC_OVERRIDE_FUERA_DE_SELECCION, mensaje: %',
      COALESCE(v_msg, '(sin error)');
  END IF;

  -- El concepto ajeno conserva su IVA y el seleccionado sigue libre.
  SELECT aplica_iva INTO v_aplica FROM public.conceptos_venta
   WHERE id = 'bbbb6666-6666-6666-6666-66666666bbbb';
  IF v_aplica IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el override ajeno modificó aplica_iva del concepto no seleccionado';
  END IF;

  SELECT estado_facturacion INTO v_estado FROM public.conceptos_venta
   WHERE id = 'bbbb5555-5555-5555-5555-55555555bbbb';
  IF COALESCE(v_estado, 'pendiente') <> 'pendiente' THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el rechazo no fue atómico; el concepto seleccionado quedó en %', v_estado;
  END IF;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: override sobre el concepto SÍ seleccionado se aplica
-- y el no seleccionado queda intacto.
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_aplica_sel boolean;
  v_aplica_otro boolean;
BEGIN
  PERFORM public.crear_proforma_atomica(
    'bbbb1111-1111-1111-1111-11111111bbbb',
    'bbbb4444-4444-4444-4444-44444444bbbb',
    'bbbb3333-3333-3333-3333-33333333bbbb',
    'Cliente IVA Overrides', 'ELOVR0001', NULL,
    ARRAY['bbbb5555-5555-5555-5555-55555555bbbb'::uuid],
    0, 0, 0, 1000, 0, 1000,
    NULL, 'tester', 30, 0.16,
    jsonb_build_object('bbbb5555-5555-5555-5555-55555555bbbb', false)
  );

  SELECT aplica_iva INTO v_aplica_sel FROM public.conceptos_venta
   WHERE id = 'bbbb5555-5555-5555-5555-55555555bbbb';
  IF v_aplica_sel IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el override válido no se aplicó al concepto seleccionado';
  END IF;

  SELECT aplica_iva INTO v_aplica_otro FROM public.conceptos_venta
   WHERE id = 'bbbb6666-6666-6666-6666-66666666bbbb';
  IF v_aplica_otro IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'LC_TEST_FALLA: el concepto no seleccionado cambió durante una proforma válida';
  END IF;
END
$caso2$ LANGUAGE plpgsql;

ROLLBACK;
