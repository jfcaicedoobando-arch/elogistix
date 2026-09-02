-- =============================================================
-- traspaso_candados_v2.sql · Ola 8 (corrección P1)
--
-- Verifica los dos candados agregados a
-- `public.registrar_traspaso_bancario`:
--   · Defecto 2 (concurrencia): la función bloquea las filas de
--     `cuentas_bancarias` (origen/destino, orden por id) ANTES de validar
--     el saldo, y revalida el saldo ya bloqueado. Como psql no puede abrir
--     dos sesiones concurrentes en este script, se prueba el efecto
--     observable: tras gastar el saldo con un primer traspaso, un segundo
--     traspaso que reutilizaría el mismo saldo se rechaza y el saldo de la
--     cuenta nunca queda negativo. Además se verifica que el cuerpo de la
--     función contiene el `FOR UPDATE` (evita que alguien quite el candado
--     sin que ningún test lo note).
--   · Defecto 3 (fecha de corte): p_fecha anterior a
--     GREATEST(origen.fecha_saldo_inicial, destino.fecha_saldo_inicial) se
--     rechaza con LC_TRASPASO_FECHA_ANTERIOR_CORTE.
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/traspaso_candados_v2.sql
-- =============================================================

BEGIN;

-- CASO 1 · el cuerpo vigente sigue teniendo el candado FOR UPDATE sobre
-- cuentas_bancarias (regresión: si alguien reescribe la función sin el
-- candado, este caso truena aunque el resto de la lógica siga "pasando").
DO $caso1$
DECLARE
  v_def text := pg_get_functiondef(
    'public.registrar_traspaso_bancario(uuid,uuid,date,numeric,numeric,numeric,text,text,uuid)'::regprocedure
  );
BEGIN
  IF v_def !~* 'FOR UPDATE' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: registrar_traspaso_bancario ya no bloquea las cuentas con FOR UPDATE';
  END IF;
  IF v_def !~* 'FECHA_ANTERIOR_CORTE' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: registrar_traspaso_bancario ya no valida la fecha de corte';
  END IF;
  RAISE NOTICE 'CASO 1 OK: el cuerpo vigente conserva el candado de saldo y el de fecha de corte';
END;
$caso1$;

-- Fixture: dos cuentas de la misma organización, saldo inicial 1000, corte
-- hoy.
DO $fixture$
DECLARE
  v_org uuid := '2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a';
  v_c1 uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_c2 uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Traspaso Candados')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cuentas_bancarias
    (id, organization_id, banco, alias, numero_cuenta, clabe, moneda,
     saldo_inicial, fecha_saldo_inicial, activa, notas)
  VALUES
    (v_c1, v_org, 'BBVA', 'Origen Candados', '0011', '000000000000000011', 'MXN',
     1000, CURRENT_DATE, true, ''),
    (v_c2, v_org, 'BBVA', 'Destino Candados', '0012', '000000000000000012', 'MXN',
     0, CURRENT_DATE, true, '')
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

-- CASO 2 · Defecto 3: p_fecha anterior a fecha_saldo_inicial se rechaza.
DO $caso2$
DECLARE
  v_c1 uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_c2 uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
BEGIN
  PERFORM public.registrar_traspaso_bancario(
    v_c1, v_c2, CURRENT_DATE - INTERVAL '1 day', 100, 1, 0,
    'Traspaso con fecha anterior al corte', '', NULL
  );
  RAISE EXCEPTION 'CASO 2 FALLÓ: se permitió un traspaso con fecha anterior al corte de saldo inicial';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM !~ 'LC_TRASPASO_FECHA_ANTERIOR_CORTE' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: error inesperado (%): %', SQLSTATE, SQLERRM;
  END IF;
  RAISE NOTICE 'CASO 2 OK: se rechaza la fecha anterior al corte (%)', SQLERRM;
END;
$caso2$;

-- CASO 3 · Defecto 2: el saldo se revalida después del candado; un segundo
-- traspaso que agotaría el saldo ya comprometido por el primero se
-- rechaza, y el saldo de la cuenta origen nunca queda negativo.
DO $caso3$
DECLARE
  v_c1 uuid := '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b';
  v_c2 uuid := '2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c';
  v_saldo numeric;
BEGIN
  -- Primer traspaso: gasta 700 de los 1000 disponibles.
  PERFORM public.registrar_traspaso_bancario(
    v_c1, v_c2, CURRENT_DATE, 700, 1, 0, 'Traspaso 1', '', NULL
  );

  v_saldo := public.saldo_cuenta_bancaria(v_c1);
  IF v_saldo <> 300 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: saldo esperado 300 tras el primer traspaso, obtuvo %', v_saldo;
  END IF;

  -- Segundo traspaso "concurrente" por 800: ya no cabe en el saldo
  -- restante (300). Debe rechazarse con el mismo candado de saldo, que es
  -- justo el que se revalida después del FOR UPDATE.
  BEGIN
    PERFORM public.registrar_traspaso_bancario(
      v_c1, v_c2, CURRENT_DATE, 800, 1, 0, 'Traspaso 2 (sobregiro)', '', NULL
    );
    RAISE EXCEPTION 'CASO 3 FALLÓ: se permitió un traspaso que sobregira la cuenta origen';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'LC_TRASPASO_SALDO_INSUFICIENTE' THEN
      RAISE EXCEPTION 'CASO 3 FALLÓ: error inesperado en el segundo traspaso (%): %', SQLSTATE, SQLERRM;
    END IF;
    RAISE NOTICE 'CASO 3 OK: el traspaso que sobregira se rechaza (%)', SQLERRM;
  END;

  v_saldo := public.saldo_cuenta_bancaria(v_c1);
  IF v_saldo < 0 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el saldo de la cuenta origen quedó negativo (%)', v_saldo;
  END IF;
  IF v_saldo <> 300 THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el saldo cambió tras el traspaso rechazado (esperado 300, obtuvo %)', v_saldo;
  END IF;
  RAISE NOTICE 'CASO 3 OK: el saldo de la cuenta origen nunca queda negativo (%)', v_saldo;
END;
$caso3$;

ROLLBACK;
