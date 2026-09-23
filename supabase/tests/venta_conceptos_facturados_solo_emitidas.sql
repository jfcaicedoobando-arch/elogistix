-- =============================================================
-- venta_conceptos_facturados_solo_emitidas.sql · P1-1
--
-- `validar_cierre_embarque` daba OK en el paso "Todos los conceptos de venta
-- facturados" con facturas en BORRADOR: el concepto pasa a
-- `estado_facturacion='facturado'` en cuanto su proforma queda 'facturada',
-- aunque la factura nunca se haya emitido (caso real ELIMP00008).
--
--   · CASO 1: sólo factura Borrador            → ok=false, facturados_sin_emitir=1
--   · CASO 2: mezcla Emitida + Borrador        → ok=false
--   · CASO 3: todas Emitidas                   → ok=true
--   · CASO 4: factura Cancelada/Sustituida     → ok=false (no cuenta)
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
  v_fac_a uuid;
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
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE VENTA FACTURADOS', '', 'cli-vf@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org, v_cli, 'ELIMP99201', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Confirmado'::public.estado_embarque)
  RETURNING id INTO v_emb;

  INSERT INTO public.proformas (organization_id, embarque_id, cliente_id, numero, estado_proforma,
                                moneda, subtotal, iva, total)
  VALUES (v_org, v_emb, v_cli, 'PRO-VF-1', 'facturada', 'MXN'::public.moneda, 100, 16, 116)
  RETURNING id INTO v_prof_a;
  INSERT INTO public.proformas (organization_id, embarque_id, cliente_id, numero, estado_proforma,
                                moneda, subtotal, iva, total)
  VALUES (v_org, v_emb, v_cli, 'PRO-VF-2', 'facturada', 'MXN'::public.moneda, 200, 32, 232)
  RETURNING id INTO v_prof_b;

  INSERT INTO public.conceptos_venta (organization_id, embarque_id, concepto, total, moneda,
                                      estado_facturacion, proforma_id)
  VALUES (v_org, v_emb, 'Flete', 100, 'MXN'::public.moneda, 'facturado', v_prof_a),
         (v_org, v_emb, 'Maniobras', 200, 'MXN'::public.moneda, 'facturado', v_prof_b);

  -- CASO 1: ambas facturas en Borrador.
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, proforma_id, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, v_prof_a, 'BORRADOR-VF-1',
          CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 100, 16, 116, 'Borrador')
  RETURNING id INTO v_fac_a;
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, proforma_id, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES (v_org, v_cli, 'CLIENTE VENTA FACTURADOS', v_emb, v_prof_b, 'BORRADOR-VF-2',
          CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 200, 32, 232, 'Borrador')
  RETURNING id INTO v_fac_b;

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

  -- CASO 2: una emitida, otra en borrador.
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_a;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 2 FALLÓ: mezcla Emitida+Borrador dio OK (%).', v_check;
    v_fallo := true;
  END IF;

  -- CASO 3: ambas emitidas.
  UPDATE public.facturas SET estado = 'Emitida' WHERE id = v_fac_b;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF NOT (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 3 FALLÓ: con todas Emitidas el check no dio OK (%).', v_check;
    v_fallo := true;
  END IF;

  -- CASO 4: cancelada / sustituida no cuentan como evidencia.
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = v_fac_a;
  UPDATE public.facturas SET estado = 'Sustituida' WHERE id = v_fac_b;
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb) -> 'checks') AS c
   WHERE c ->> 'regla' = 'venta_conceptos_facturados';
  IF (v_check ->> 'ok')::boolean THEN
    RAISE WARNING 'CASO 4 FALLÓ: Cancelada/Sustituida dieron OK (%).', v_check;
    v_fallo := true;
  END IF;

  IF v_fallo THEN
    RAISE EXCEPTION 'venta_conceptos_facturados_solo_emitidas: hubo casos fallidos.';
  END IF;
  RAISE NOTICE 'venta_conceptos_facturados_solo_emitidas: 4/4 casos OK.';
END $$;

ROLLBACK;
