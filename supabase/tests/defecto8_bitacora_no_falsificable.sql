-- =============================================================
-- defecto8_bitacora_no_falsificable.sql · Auditoría 2026-09-10 (Defecto 8, P1)
--
-- La bitácora es evidencia de auditoría: si el cliente puede insertar filas
-- directas, puede fabricar entradas con otro usuario_id / email / módulo.
-- Este test valida el cierre de esa puerta:
--   b) No queda ninguna policy de INSERT en la tabla: con RLS activo y sin
--      policy de escritura, el INSERT directo del cliente queda cerrado
--      (el GRANT masivo de CI no puede otorgar lo que RLS niega).
--   c) `public.registrar_bitacora` es SECURITY DEFINER y sólo la puede
--      ejecutar `authenticated` (nunca `anon`).
--   d) La RPC deriva el actor del servidor (auth.uid()), no de parámetros:
--      su firma no expone usuario_id/email como argumentos.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/defecto8_bitacora_no_falsificable.sql
-- =============================================================

BEGIN;

-- (b) sin policies de INSERT
DO $chk$
DECLARE
  v_policies text;
BEGIN
  SELECT string_agg(policyname, ', ')
    INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'bitacora_actividad'
     AND cmd IN ('INSERT', 'ALL')
     -- Las RESTRICTIVE no otorgan nada: sólo acotan lo ya permitido.
     AND permissive = 'PERMISSIVE';
  IF v_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'DEFECTO 8 REGRESIÓN: quedan policies de escritura en bitacora_actividad: %', v_policies;
  END IF;
END
$chk$;

-- (c) RPC SECURITY DEFINER, ejecutable sólo por authenticated
DO $chk$
DECLARE
  v_oid oid;
  v_secdef boolean;
BEGIN
  SELECT p.oid, p.prosecdef
    INTO v_oid, v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'registrar_bitacora'
   LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'DEFECTO 8 REGRESIÓN: no existe public.registrar_bitacora';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'DEFECTO 8 REGRESIÓN: registrar_bitacora dejó de ser SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'DEFECTO 8 REGRESIÓN: authenticated no puede ejecutar registrar_bitacora';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'DEFECTO 8 REGRESIÓN: anon puede ejecutar registrar_bitacora';
  END IF;
END
$chk$;

-- (d) el actor NO puede suplantarse: aunque la firma acepte p_usuario_id (lo
-- usan las llamadas internas sin JWT), con un JWT de usuario la función pisa
-- el actor con auth.uid() y el email lo lee de auth.users.
DO $chk$
DECLARE
  v_src text;
BEGIN
  SELECT p.prosrc
    INTO v_src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'registrar_bitacora'
     AND pg_get_function_identity_arguments(p.oid) ILIKE '%p_usuario_id%'
   LIMIT 1;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'DEFECTO 8 REGRESIÓN: no existe la RPC registrar_bitacora esperada';
  END IF;
  IF v_src NOT LIKE '%v_uid := auth.uid();%' THEN
    RAISE EXCEPTION
      'DEFECTO 8 REGRESIÓN: registrar_bitacora no fuerza el actor a auth.uid() con JWT de usuario';
  END IF;
  IF v_src NOT LIKE '%SELECT email INTO v_email FROM auth.users%' THEN
    RAISE EXCEPTION
      'DEFECTO 8 REGRESIÓN: el email de la bitácora ya no se deriva de auth.users';
  END IF;
END
$chk$;

ROLLBACK;
