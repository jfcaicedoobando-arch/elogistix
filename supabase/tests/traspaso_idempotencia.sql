-- =============================================================
-- traspaso_idempotencia.sql · OLA A (A.1)
--
-- Los traspasos entre cuentas propias eran la única mutación monetaria sin
-- dedupe server-side: un doble clic o un retry de red creaba dos traspasos.
-- Aquí se verifica el candado:
--   · la firma de `registrar_traspaso_bancario` acepta `p_client_request_id`;
--   · el índice UNIQUE parcial rechaza (23505) un segundo traspaso con la
--     misma clave de intento;
--   · dos claves distintas (o NULL) siguen siendo válidas.
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/traspaso_idempotencia.sql
-- =============================================================

BEGIN;

-- CASO 1 · la firma nueva existe (9 parámetros, el último uuid).
DO $caso1$
BEGIN
  IF to_regprocedure(
       'public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text, uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: registrar_traspaso_bancario no acepta p_client_request_id';
  END IF;
  RAISE NOTICE 'CASO 1 OK: la RPC acepta la clave de idempotencia';
END;
$caso1$;

-- CASO 2 · la firma vieja sin clave ya no existe (no hay camino sin candado).
DO $caso2$
BEGIN
  IF to_regprocedure(
       'public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text)'
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: sigue existiendo la firma sin p_client_request_id';
  END IF;
  RAISE NOTICE 'CASO 2 OK: no queda firma sin clave de idempotencia';
END;
$caso2$;

-- Fixture de cuentas para probar el índice UNIQUE parcial.
DO $fixture$
DECLARE
  v_org uuid := '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a';
  v_c1 uuid := '1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b';
  v_c2 uuid := '1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Traspaso Idem')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cuentas_bancarias
    (id, organization_id, banco, alias, numero_cuenta, clabe, moneda,
     saldo_inicial, fecha_saldo_inicial, activa, notas)
  VALUES
    (v_c1, v_org, 'BBVA', 'Origen Idem', '0001', '000000000000000001', 'MXN',
     100000, CURRENT_DATE, true, ''),
    (v_c2, v_org, 'BBVA', 'Destino Idem', '0002', '000000000000000002', 'MXN',
     0, CURRENT_DATE, true, '')
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

-- CASO 3 · dos traspasos con la MISMA clave → 23505.
DO $caso3$
DECLARE
  v_org uuid := '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a';
  v_c1 uuid := '1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b';
  v_c2 uuid := '1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c';
  v_clave uuid := '1d1d1d1d-1d1d-1d1d-1d1d-1d1d1d1d1d1d';
BEGIN
  INSERT INTO public.traspasos_bancarios
    (organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
     monto_origen, moneda_origen, monto_destino, moneda_destino,
     tipo_cambio, comision, concepto, referencia, client_request_id)
  VALUES
    (v_org, 'TR-IDEM01', v_c1, v_c2, CURRENT_DATE,
     1000, 'MXN', 1000, 'MXN', 1, 0, 'Traspaso idem', '', v_clave);

  BEGIN
    INSERT INTO public.traspasos_bancarios
      (organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
       monto_origen, moneda_origen, monto_destino, moneda_destino,
       tipo_cambio, comision, concepto, referencia, client_request_id)
    VALUES
      (v_org, 'TR-IDEM02', v_c1, v_c2, CURRENT_DATE,
       1000, 'MXN', 1000, 'MXN', 1, 0, 'Traspaso idem retry', '', v_clave);
    RAISE EXCEPTION 'CASO 3 FALLÓ: se permitió un traspaso duplicado con la misma clave';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'CASO 3 OK: el retry con la misma clave se rechaza (23505)';
  END;
END;
$caso3$;

-- CASO 4 · claves distintas y NULL siguen permitidas (sin backfill histórico).
DO $caso4$
DECLARE
  v_org uuid := '1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a';
  v_c1 uuid := '1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b';
  v_c2 uuid := '1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c';
BEGIN
  INSERT INTO public.traspasos_bancarios
    (organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
     monto_origen, moneda_origen, monto_destino, moneda_destino,
     tipo_cambio, comision, concepto, referencia, client_request_id)
  VALUES
    (v_org, 'TR-IDEM03', v_c1, v_c2, CURRENT_DATE,
     500, 'MXN', 500, 'MXN', 1, 0, 'Otra clave', '',
     '1e1e1e1e-1e1e-1e1e-1e1e-1e1e1e1e1e1e'),
    (v_org, 'TR-IDEM04', v_c1, v_c2, CURRENT_DATE,
     500, 'MXN', 500, 'MXN', 1, 0, 'Sin clave A', '', NULL),
    (v_org, 'TR-IDEM05', v_c1, v_c2, CURRENT_DATE,
     500, 'MXN', 500, 'MXN', 1, 0, 'Sin clave B', '', NULL);
  RAISE NOTICE 'CASO 4 OK: claves distintas y filas históricas sin clave conviven';
END;
$caso4$;

ROLLBACK;
