-- =============================================================
-- cotizacion_costos_estado_candado.sql
--
-- Addendum P1 (v13.823.358) — `actualizar_cotizacion_costos` sólo reemplaza la
-- base de costos mientras la cotización sigue en captura:
--
--   * estado Borrador/Solicitada  → permitido
--   * cualquier otro estado       → LC_COT_COSTOS_ESTADO_INVALIDO
--   * con embarque vinculado      → LC_COT_COSTOS_CON_EMBARQUE
--
-- Antes el trigger `cotizaciones_guard_en_operacion` protegía subtotal / moneda
-- / conceptos_venta, pero NO los costos: una llamada autenticada directa podía
-- borrar la base de costos de una cotización Aceptada y dejar el P&L
-- desincronizado.
--
-- La verificación es estática (pg_get_functiondef) más una prueba funcional del
-- orden de los candados: el rol de los guards no tiene EXECUTE sobre la RPC
-- (sólo `authenticated`/`service_role`) y ejecutar la ruta real exigiría sembrar
-- sesión de auth.
--
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cotizacion_costos_estado_candado.sql
-- =============================================================

BEGIN;

DO $costos$
DECLARE
  d text := pg_get_functiondef('public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz)'::regprocedure);
  v_pos_estado    integer;
  v_pos_embarque  integer;
  v_pos_delete    integer;
  v_pos_idem      integer;
BEGIN
  IF position('LC_COT_COSTOS_ESTADO_INVALIDO' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: actualizar_cotizacion_costos ya no valida el estado de la cotización';
  END IF;
  IF position('LC_COT_COSTOS_CON_EMBARQUE' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION: actualizar_cotizacion_costos ya no rechaza cotizaciones con embarque vinculado';
  END IF;
  IF d !~ 'Borrador''::estado_cotizacion, ''Solicitada''::estado_cotizacion' THEN
    RAISE EXCEPTION 'REGRESION: los estados permitidos para editar costos ya no son Borrador/Solicitada';
  END IF;

  -- El candado debe evaluarse ANTES de borrar los costos y antes del replay de
  -- idempotencia (para que un reintento no devuelva respuesta almacenada de una
  -- cotización que ya se cerró).
  v_pos_estado   := position('LC_COT_COSTOS_ESTADO_INVALIDO' in d);
  v_pos_embarque := position('LC_COT_COSTOS_CON_EMBARQUE' in d);
  v_pos_idem     := position('idempotency_claim' in d);
  v_pos_delete   := position('DELETE FROM cotizacion_costos' in d);

  IF NOT (v_pos_estado < v_pos_idem AND v_pos_embarque < v_pos_idem) THEN
    RAISE EXCEPTION 'REGRESION: el candado de estado debe evaluarse antes del replay de idempotencia';
  END IF;
  IF NOT (v_pos_estado < v_pos_delete) THEN
    RAISE EXCEPTION 'REGRESION: el candado de estado debe evaluarse antes de borrar los costos';
  END IF;

  -- La autoridad (organización + rol escritor) sigue primero que todo.
  IF NOT (position('_assert_writer_cotizacion' in d) < v_pos_estado) THEN
    RAISE EXCEPTION 'REGRESION: la autoridad debe validarse antes del candado de estado';
  END IF;

  RAISE NOTICE 'OK cotizacion_costos_estado_candado: candado de estado/embarque instalado y ordenado';
END
$costos$;

-- Los permisos siguen siendo los del contrato: nunca PUBLIC/anon.
DO $acl$
BEGIN
  IF has_function_privilege('anon', 'public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESION: anon puede ejecutar actualizar_cotizacion_costos';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.actualizar_cotizacion_costos(uuid, jsonb, uuid, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'REGRESION: authenticated perdió EXECUTE sobre actualizar_cotizacion_costos';
  END IF;
END
$acl$;

ROLLBACK;
