-- =============================================================
-- fix2_embarques_interno_y_nc.sql · FIX2 ronda 2
--
-- 1) B-1: las columnas internas de `embarques` (cerrado_snapshot,
--    tarifa_delta_jsonb, reabierto_motivo, created_by_email) NO deben ser
--    legibles por `authenticated` (RLS filtra filas, no columnas: un usuario
--    del portal con acceso a su fila podía leer el PnL con select=*).
--    El staff las lee por la vista `public.embarques_interno_v`.
-- 2) B-2: máquina canónica de estados de NC de cliente:
--    Borrador→{Timbrada,Cancelada} · Timbrada→{Aplicada,Cancelada}
--    Aplicada→{Cancelada} · Aprobada (legado, sólo salida)→{Timbrada,Cancelada}
-- 3) B-3: `puede_escribir_cotizaciones` = espejo de SALES (con admin_org,
--    sin operador).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix2_embarques_interno_y_nc.sql
-- =============================================================

BEGIN;

\ir _catalogo_columnas_internas.sql

-- ---------- CASO 1 · privilegios de columna revocados -------------------
DO $caso1$
DECLARE
  v_col text;
BEGIN
  FOREACH v_col IN ARRAY pg_temp.columnas_internas_embarques()
  LOOP
    IF has_column_privilege('authenticated', 'public.embarques', v_col, 'SELECT') THEN
      RAISE EXCEPTION 'CASO 1 FALLÓ: authenticated aún puede leer embarques.%', v_col;
    END IF;
    IF has_column_privilege('anon', 'public.embarques', v_col, 'SELECT') THEN
      RAISE EXCEPTION 'CASO 1 FALLÓ: anon aún puede leer embarques.%', v_col;
    END IF;
  END LOOP;

  -- Contraprueba: una columna operativa sigue legible.
  IF NOT has_column_privilege('authenticated', 'public.embarques', 'expediente', 'SELECT') THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se revocó de más (expediente no es legible)';
  END IF;
END;
$caso1$;

-- ---------- CASO 2 · vista interna existe y sólo para staff -------------
DO $caso2$
DECLARE
  v_def text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'embarques_interno_v'
  ) THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: falta la vista public.embarques_interno_v';
  END IF;

  SELECT pg_get_viewdef('public.embarques_interno_v'::regclass, true) INTO v_def;
  IF v_def NOT ILIKE '%is_org_member%' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la vista interna no valida membresía de organización';
  END IF;
  IF v_def NOT ILIKE '%cliente%' OR v_def NOT ILIKE '%agente_carga%' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la vista interna no excluye a los roles de portal';
  END IF;

  IF has_table_privilege('anon', 'public.embarques_interno_v', 'SELECT') THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: anon puede leer la vista interna';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.embarques_interno_v', 'SELECT') THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: authenticated no puede leer la vista interna';
  END IF;
END;
$caso2$;

-- ---------- CASO 3 · get_embarque_full ya no usa la fila completa -------
DO $caso3$
DECLARE
  v_def text := pg_get_functiondef('public.get_embarque_full(uuid)'::regprocedure);
BEGIN
  IF v_def ILIKE '%to_jsonb(e.*)%' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: get_embarque_full sigue usando to_jsonb(e.*) (exige privilegio sobre columnas internas)';
  END IF;
  IF v_def NOT ILIKE '%embarques_interno_v%' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: get_embarque_full no fusiona las columnas internas desde la vista';
  END IF;
END;
$caso3$;

-- ---------- CASO 4 · máquina de estados de NC --------------------------
DO $caso4$
DECLARE
  v_src text := pg_get_functiondef('public.guard_nc_cliente_transicion()'::regprocedure);
  v_cuerpo text;
BEGIN
  -- Comparamos sólo líneas no comentadas para no confundir documentación con lógica.
  SELECT string_agg(l, E'\n') INTO v_cuerpo
  FROM regexp_split_to_table(v_src, E'\n') AS l
  WHERE btrim(l) NOT LIKE '--%';

  IF v_cuerpo NOT LIKE '%''Borrador''%''Timbrada''%' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: la BD no admite Borrador→Timbrada (el timbrado desde la app se bloquearía)';
  END IF;
  IF v_cuerpo LIKE '%v_old = ''Borrador''  AND v_new IN (''Aprobada''%' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: sigue exigiendo pasar por Aprobada';
  END IF;
  IF v_cuerpo NOT LIKE '%''Aplicada''%''Cancelada''%' THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: no permite cancelar una NC ya aplicada';
  END IF;
END;
$caso4$;

-- ---------- CASO 5 · permisos de cotizaciones (canon v13.750.0) ---------
-- El canon SALES-only se amplió en v13.750.0: los roles operativos
-- (coordinador_logistico, gerente_operaciones, operador, customer_service)
-- también cotizan porque son quienes reciben la solicitud del cliente.
-- Lo que sigue prohibido es que roles sin relación comercial escriban
-- (contador, tesorero, cliente_portal, auditor, invitado).
DO $caso5$
DECLARE
  v_def text := pg_get_functiondef('public.puede_escribir_cotizaciones(uuid)'::regprocedure);
  v_rol text;
BEGIN
  IF v_def NOT LIKE '%admin_org%' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: admin_org (dueño de organización) no puede escribir cotizaciones';
  END IF;
  IF v_def NOT LIKE '%vendedor%' OR v_def NOT LIKE '%gerente_comercial%'
     OR v_def NOT LIKE '%ejecutivo_pricing%' OR v_def NOT LIKE '%super_admin%' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: falta algún rol del canon SALES';
  END IF;
  IF v_def NOT LIKE '%coordinador_logistico%' OR v_def NOT LIKE '%gerente_operaciones%'
     OR v_def NOT LIKE '%''operador''%' OR v_def NOT LIKE '%customer_service%' THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: falta algún rol operativo habilitado en v13.750.0';
  END IF;
  FOREACH v_rol IN ARRAY ARRAY['contador', 'tesorero', 'cliente_portal', 'auditor'] LOOP
    IF v_def LIKE '%''' || v_rol || '''%' THEN
      RAISE EXCEPTION 'CASO 5 FALLÓ: % obtuvo escritura en cotizaciones (fuera del canon)', v_rol;
    END IF;
  END LOOP;
END;
$caso5$;

DO $ok$ BEGIN RAISE NOTICE 'fix2_embarques_interno_y_nc.sql: 5/5 casos OK'; END $ok$;

ROLLBACK;
