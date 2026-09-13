-- =============================================================
-- cotizacion_aceptar_cliente_candado.sql
--
-- Addendum P1 (v13.823.359) — `aceptar_cotizacion_version` exige convertibilidad
-- ANTES del camino idempotente:
--
--   * prospecto sin oportunidad ligada → LC_COT_SIN_OPORTUNIDAD
--   * cotización transaccional sin cliente → LC_COT_SIN_CLIENTE
--   * informativa (tarifario) → exenta
--
-- Antes, el camino idempotente (estado ya Aceptada/En operación) sólo revisaba la
-- oportunidad cuando ésta NO era NULL, así que una cotización legada de prospecto
-- sin cliente ni oportunidad (COT-2026-0016) devolvía éxito y luego no podía
-- convertirse en embarque: callejón sin salida.
--
-- Verificación estática (pg_get_functiondef) + ACL: ejecutar la ruta real exigiría
-- sembrar sesión de auth y el rol de los guards no tiene EXECUTE sobre la RPC.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cotizacion_aceptar_cliente_candado.sql
-- =============================================================

BEGIN;

DO $aceptar$
DECLARE
  d text := pg_get_functiondef('public.aceptar_cotizacion_version(uuid)'::regprocedure);
  v_pos_cliente integer;
  v_pos_oport   integer;
  v_pos_idem    integer;
  v_pos_update  integer;
  v_pos_autor   integer;
BEGIN
  IF position('LC_COT_SIN_CLIENTE' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: aceptar_cotizacion_version ya no exige cliente asignado';
  END IF;
  IF position('LC_COT_SIN_OPORTUNIDAD' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: aceptar_cotizacion_version ya no exige oportunidad en prospectos';
  END IF;
  IF d !~ 'v_cliente_id IS NULL' THEN
    RAISE EXCEPTION 'REGRESION: falta la validación explícita de cliente_id NULL';
  END IF;
  IF d !~ 'v_tipo_documento, ''transaccional''\) <> ''informativa''' THEN
    RAISE EXCEPTION 'REGRESION: las informativas deben seguir exentas del candado';
  END IF;

  v_pos_cliente := position('LC_COT_SIN_CLIENTE' in d);
  v_pos_oport   := position('LC_COT_SIN_OPORTUNIDAD' in d);
  v_pos_idem    := position('IF v_estado_actual IN (''Aceptada'',''En operación'') THEN' in d);
  v_pos_update  := position('UPDATE cotizaciones' in d);
  v_pos_autor   := position('LC_NO_AUTORIZADO' in d);

  IF v_pos_idem = 0 THEN
    RAISE EXCEPTION 'REGRESION: no se localizó el camino idempotente (Aceptada/En operación)';
  END IF;

  -- Los candados deben quedar ARRIBA del retorno idempotente: un reintento sobre
  -- una cotización legada inconsistente no puede devolver éxito.
  IF NOT (v_pos_cliente < v_pos_idem AND v_pos_oport < v_pos_idem) THEN
    RAISE EXCEPTION 'REGRESION: los candados de cliente/oportunidad deben evaluarse antes del camino idempotente';
  END IF;
  IF NOT (v_pos_cliente < v_pos_update) THEN
    RAISE EXCEPTION 'REGRESION: el candado de cliente debe evaluarse antes de sellar la aceptación';
  END IF;

  -- La autoridad (rol + organización) y la segregación de funciones siguen primero.
  IF NOT (v_pos_autor < v_pos_cliente) THEN
    RAISE EXCEPTION 'REGRESION: la validación de rol debe seguir antes de los candados de datos';
  END IF;
  IF position('LC_SOD_VIOLATION' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: se perdió la segregación de funciones al aceptar';
  END IF;

  RAISE NOTICE 'OK · aceptar_cotizacion_version exige cliente (y oportunidad en prospectos) también en reintentos';
END
$aceptar$;

-- ACL: sólo authenticated/service_role ejecutan la RPC.
DO $acl$
BEGIN
  IF has_function_privilege('anon', 'public.aceptar_cotizacion_version(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESION: anon puede ejecutar aceptar_cotizacion_version';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.aceptar_cotizacion_version(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESION: authenticated perdió EXECUTE sobre aceptar_cotizacion_version';
  END IF;
  RAISE NOTICE 'OK · permisos de aceptar_cotizacion_version intactos';
END
$acl$;

ROLLBACK;
