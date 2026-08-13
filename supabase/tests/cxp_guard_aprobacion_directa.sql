-- =============================================================
-- cxp_guard_aprobacion_directa.sql · Ola 11 · RNF-07
--
-- Tests conductuales de `trg_guard_aprobacion_proveedor_factura`:
-- nadie puede pasar una factura de proveedor a "aprobada"/"rechazada"
-- con un UPDATE directo (REST/psql); sólo el canal oficial
-- `aprobar_factura_proveedor()`, que declara la marca de sesión
-- `app.aprobando_cxp`.
--
-- Corre en CI como paso adicional del workflow rls-tests.
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cxp_guard_aprobacion_directa.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org  uuid := 'aaaaaaa1-0000-4000-8000-000000000001';
  v_prov uuid := 'aaaaaaa1-0000-4000-8000-000000000002';
  v_cat  uuid := 'aaaaaaa1-0000-4000-8000-000000000003';
  v_fact uuid := 'aaaaaaa1-0000-4000-8000-000000000004';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Guard Aprobacion')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Test Prov Guard Aprobacion', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias
    (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Test Guard Aprobacion', 0, true, 'CostoDirectoEmbarque');

  INSERT INTO public.proveedor_facturas
    (id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
     categoria_presupuesto_id,
     moneda, tipo_cambio_usd, subtotal, iva, total, estado, estado_aprobacion)
  VALUES
    (v_fact, v_org, v_prov, 'Test Prov', 'GUARD-APROB-01',
     v_cat, 'MXN'::public.moneda, 0, 1000, 0, 1000, 'Borrador', 'pendiente');
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1: UPDATE directo a 'aprobada' → 42501 (bloqueado)
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_sqlstate text;
  v_msg text;
BEGIN
  BEGIN
    UPDATE public.proveedor_facturas
       SET estado_aprobacion = 'aprobada'
     WHERE id = 'aaaaaaa1-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'RNF-07 FAIL: el UPDATE directo a "aprobada" NO fue bloqueado';
  EXCEPTION WHEN OTHERS THEN
    v_sqlstate := SQLSTATE; v_msg := SQLERRM;
    IF v_sqlstate <> '42501' OR v_msg NOT LIKE '%LC_CXP_APROBACION_DIRECTA%' THEN
      RAISE;
    END IF;
  END;
  RAISE NOTICE 'CASO 1 OK: aprobación directa bloqueada';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: UPDATE directo a 'rechazada' → 42501 (bloqueado)
-- -------------------------------------------------------------
DO $caso2$
DECLARE
  v_sqlstate text;
BEGIN
  BEGIN
    UPDATE public.proveedor_facturas
       SET estado_aprobacion = 'rechazada', motivo_rechazo = 'directo'
     WHERE id = 'aaaaaaa1-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'RNF-07 FAIL: el UPDATE directo a "rechazada" NO fue bloqueado';
  EXCEPTION WHEN OTHERS THEN
    v_sqlstate := SQLSTATE;
    IF v_sqlstate <> '42501' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'CASO 2 OK: rechazo directo bloqueado';
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: volver a 'pendiente' SÍ se permite (re-aprobación tras editar)
-- CASO 4: con la marca de sesión del canal oficial el UPDATE pasa
-- -------------------------------------------------------------
DO $caso34$
DECLARE
  v_estado text;
BEGIN
  UPDATE public.proveedor_facturas
     SET estado_aprobacion = 'pendiente'
   WHERE id = 'aaaaaaa1-0000-4000-8000-000000000004';
  RAISE NOTICE 'CASO 3 OK: volver a pendiente permitido';

  PERFORM set_config('app.aprobando_cxp', '1', true);
  UPDATE public.proveedor_facturas
     SET estado_aprobacion = 'aprobada', aprobada_at = now()
   WHERE id = 'aaaaaaa1-0000-4000-8000-000000000004';
  PERFORM set_config('app.aprobando_cxp', '0', true);

  SELECT estado_aprobacion::text INTO v_estado
    FROM public.proveedor_facturas
   WHERE id = 'aaaaaaa1-0000-4000-8000-000000000004';
  IF v_estado <> 'aprobada' THEN
    RAISE EXCEPTION 'RNF-07 FAIL: el canal oficial no pudo aprobar (estado=%)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 4 OK: canal oficial aprueba';
END
$caso34$ LANGUAGE plpgsql;

ROLLBACK;
