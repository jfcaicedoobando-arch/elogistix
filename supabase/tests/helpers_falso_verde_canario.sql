-- =============================================================
-- helpers_falso_verde_canario.sql · v13.823.55
--
-- Canario POSITIVO de los helpers de aserción: demuestra que una sentencia
-- PERMITIDA hace fallar al helper. Antes de v13.823.55, el RAISE de "no fue
-- bloqueado" vivía dentro del bloque EXCEPTION del propio helper y su SQLSTATE
-- (P0001 = raise_exception) lo atrapaba el WHEN, así que el helper aprobaba
-- cualquier sentencia permitida: falso verde silencioso.
--
-- El canario NO puede atraparse a sí mismo: la comprobación final del veredicto
-- ocurre FUERA del bloque que captura la excepción del helper.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/helpers_falso_verde_canario.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Copia local del helper de la suite CRM (mismo patrón corregido).
CREATE OR REPLACE FUNCTION pg_temp.espera_lc(_sql text, _codigo text, _caso text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_msg text;
  v_permitido boolean := false;
BEGIN
  BEGIN
    EXECUTE _sql;
    v_permitido := true;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF position(_codigo in v_msg) = 0 THEN
      RAISE EXCEPTION 'FALLO %: se esperaba % y llegó «%»', _caso, _codigo, v_msg;
    END IF;
  END;

  IF v_permitido THEN
    RAISE EXCEPTION 'FALLO %: se esperaba % y la operación fue permitida', _caso, _codigo;
  END IF;
END;
$$;

CREATE TEMP TABLE canario_permitido (
  id serial primary key,
  dato text CHECK (dato <> 'bloqueado')
);

DO $$
DECLARE
  v_detecto_1 boolean := false;
  v_detecto_2 boolean := false;
  v_msg text;
BEGIN
  -- 1) assert_insert_blocked contra un INSERT que SÍ se permite.
  BEGIN
    PERFORM pg_temp.assert_insert_blocked(
      'INSERT INTO canario_permitido (dato) VALUES (''libre'')',
      'canario: insert permitido');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_detecto_1 := (position('NO fue bloqueado' in v_msg) > 0);
  END;

  -- 2) espera_lc contra una sentencia que SÍ se permite. El mensaje de fallo del
  --    helper incluye el LC_* esperado: exactamente el texto que producía el
  --    falso verde cuando el RAISE vivía dentro del EXCEPTION.
  BEGIN
    PERFORM pg_temp.espera_lc(
      'INSERT INTO canario_permitido (dato) VALUES (''libre 2'')',
      'LC_CANARIO_FALSO_VERDE', 'canario: espera_lc permitido');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    v_detecto_2 := (position('la operación fue permitida' in v_msg) > 0);
  END;

  -- Veredicto FUERA de los bloques EXCEPTION: si el canario fallara, su propio
  -- RAISE ya no puede ser capturado por los handlers de arriba.
  IF NOT v_detecto_1 THEN
    RAISE EXCEPTION 'CANARIO FAIL: assert_insert_blocked aprobó un INSERT permitido (falso verde)';
  END IF;
  IF NOT v_detecto_2 THEN
    RAISE EXCEPTION 'CANARIO FAIL: espera_lc aprobó una sentencia permitida (falso verde)';
  END IF;

  -- Contra-prueba: los helpers siguen aceptando bloqueos reales.
  PERFORM pg_temp.assert_insert_blocked(
    'INSERT INTO canario_permitido (dato) VALUES (''bloqueado'')',
    'canario: bloqueo real');

  RAISE NOTICE 'helpers_falso_verde_canario OK · los helpers fallan ante sentencias permitidas y siguen aceptando bloqueos reales.';
END $$;

ROLLBACK;
