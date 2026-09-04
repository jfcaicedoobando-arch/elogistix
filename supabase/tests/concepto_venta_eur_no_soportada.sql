-- =============================================================
-- concepto_venta_eur_no_soportada.sql
--
-- Decisión de negocio: hoy NO existen ventas en EUR. El selector de UI ya
-- ofrece sólo MXN/USD; este guard verifica el candado server-side:
--   · INSERT de concepto de venta en EUR         -> LC_VENTA_EUR_NO_SOPORTADA
--   · UPDATE de la moneda a EUR                  -> LC_VENTA_EUR_NO_SOPORTADA
--   · MXN/USD siguen permitidos
--   · conceptos de COSTO en EUR siguen permitidos (soporte vigente)
--
-- Todo dentro de BEGIN…ROLLBACK.
--   psql "$SUPABASE_DB_URL" -f supabase/tests/concepto_venta_eur_no_soportada.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('e0e0e0e0-0000-4000-8000-000000000010', 'Test Venta EUR Guard');

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('e0e0e0e0-0000-4000-8000-000000000011', 'e0e0e0e0-0000-4000-8000-000000000010',
        'Cliente Venta EUR', 'venta-eur-cliente@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, tipo_cambio_usd)
VALUES ('e0e0e0e0-0000-4000-8000-000000000020', 'e0e0e0e0-0000-4000-8000-000000000010',
        'e0e0e0e0-0000-4000-8000-000000000011', 'Marítimo', 'Importación', 20);

DO $guard$
DECLARE
  v_id uuid;
  v_sqlstate text;
  v_msg text;
  v_bloqueado boolean;
BEGIN
  -- ── Caso 1: INSERT en EUR bloqueado ──────────────────────────────────────
  v_bloqueado := false;
  BEGIN
    INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion,
                                        cantidad, precio_unitario, total, moneda)
    VALUES ('e0e0e0e0-0000-4000-8000-000000000020', 'e0e0e0e0-0000-4000-8000-000000000010',
            'Flete EUR', 1, 100, 100, 'EUR');
  EXCEPTION WHEN OTHERS THEN
    v_sqlstate := SQLSTATE; v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_VENTA_EUR_NO_SOPORTADA%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'FAIL: se pudo insertar un concepto de VENTA en EUR';
  END IF;

  -- ── Caso 2: MXN permitido ────────────────────────────────────────────────
  INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion,
                                      cantidad, precio_unitario, total, moneda)
  VALUES ('e0e0e0e0-0000-4000-8000-000000000020', 'e0e0e0e0-0000-4000-8000-000000000010',
          'Flete MXN', 1, 1000, 1000, 'MXN')
  RETURNING id INTO v_id;

  -- ── Caso 3: UPDATE de moneda a EUR bloqueado ─────────────────────────────
  v_bloqueado := false;
  BEGIN
    UPDATE public.conceptos_venta SET moneda = 'EUR' WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_VENTA_EUR_NO_SOPORTADA%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'FAIL: se pudo cambiar la moneda de un concepto de VENTA a EUR';
  END IF;

  -- ── Caso 4: USD permitido en venta ───────────────────────────────────────
  UPDATE public.conceptos_venta SET moneda = 'USD' WHERE id = v_id;

  -- ── Caso 5: COSTO en EUR sigue soportado ─────────────────────────────────
  INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
  VALUES ('e0e0e0e0-0000-4000-8000-000000000020', 'e0e0e0e0-0000-4000-8000-000000000010',
          'Handling origen', 50, 'EUR');

  RAISE NOTICE 'OK: la venta en EUR se rechaza server-side y el costo en EUR sigue soportado.';
END
$guard$ LANGUAGE plpgsql;

ROLLBACK;
