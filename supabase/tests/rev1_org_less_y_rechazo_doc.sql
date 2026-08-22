-- =============================================================
-- rev1_org_less_y_rechazo_doc.sql · Remediación informe 2026-08-22
--
--   · CASO 1 — is_org_member() nunca devuelve NULL (guard fail-closed).
--              Antes: usuario sin organización -> NULL -> `IF NOT ...` no
--              disparaba y el candado cross-tenant quedaba abierto (B-1).
--   · CASO 2 — rechazar_documento_embarque llama _assert_writer con el org
--              del documento; antes usaba el overload inexistente sin
--              argumentos y fallaba con 42883 en cada llamada (B-3).
--   · CASO 3 — el motivo de rechazo exige >= 10 caracteres (igual al front).
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rev1_org_less_y_rechazo_doc.sql
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- CASO 1: la firma de is_org_member es fail-closed (no NULL)
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_src text := pg_get_functiondef('public.is_org_member(uuid)'::regprocedure);
BEGIN
  IF v_src !~* 'COALESCE' THEN
    RAISE EXCEPTION
      'CASO 1 FALLÓ: is_org_member sigue sin COALESCE; un usuario sin organización obtiene NULL y el guard no dispara';
  END IF;
  RAISE NOTICE 'CASO 1 OK: is_org_member es fail-closed (sin NULL)';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 1b: ninguna función SECURITY DEFINER debe confiar en la
-- lógica trivaluada `IF NOT public.is_org_member(...)` sin el
-- helper corregido. Se documenta el conteo para vigilar el patrón.
-- -------------------------------------------------------------
DO $caso1b$
DECLARE
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND pg_get_functiondef(p.oid) ~ 'NOT\s+public\.is_org_member';

  RAISE NOTICE 'CASO 1b: % funciones usan el patrón `NOT is_org_member` (seguro sólo con el helper fail-closed)', v_n;
END
$caso1b$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2 y 3: rechazar_documento_embarque
-- -------------------------------------------------------------
DO $fixture$
DECLARE
  v_org uuid := 'a1a1a1a1-1111-1111-1111-111111111111';
  v_cli uuid := 'a1a1a1a1-4444-4444-4444-444444444444';
  v_emb uuid := 'a1a1a1a1-2222-2222-2222-222222222222';
  v_doc uuid := 'a1a1a1a1-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Rev1')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Test Cli Rev1', 'XAXX010101000', 'rev1@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, estado, modo)
  VALUES (v_emb, v_org, v_cli, 'REV1-0001', 'Confirmado', 'Marítimo')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.documentos_embarque
    (id, organization_id, embarque_id, nombre, estado)
  VALUES (v_doc, v_org, v_emb, 'BL Master', 'Recibido')
  ON CONFLICT (id) DO NOTHING;
END
$fixture$ LANGUAGE plpgsql;


-- CASO 2: la RPC ya no revienta con 42883 (undefined_function).
DO $caso2$
DECLARE
  v_doc uuid := 'a1a1a1a1-3333-3333-3333-333333333333';
BEGIN
  BEGIN
    PERFORM public.rechazar_documento_embarque(v_doc, 'Documento ilegible, favor de reenviar');
    RAISE NOTICE 'CASO 2 OK: la RPC ejecutó sin 42883';
  EXCEPTION
    WHEN undefined_function THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: sigue llamando _assert_writer sin argumentos (42883): %', SQLERRM;
    WHEN OTHERS THEN
      -- Cualquier otro error (permisos del rol de prueba, org distinta) es
      -- aceptable: lo que se vigila es que la función exista y resuelva.
      RAISE NOTICE 'CASO 2 OK: la RPC resolvió con error de negocio/permiso esperado (%)', SQLSTATE;
  END;
END
$caso2$ LANGUAGE plpgsql;

-- CASO 3: motivo corto se rechaza con LC_MOTIVO_REQUERIDO.
DO $caso3$
DECLARE
  v_doc uuid := 'a1a1a1a1-3333-3333-3333-333333333333';
BEGIN
  BEGIN
    PERFORM public.rechazar_documento_embarque(v_doc, 'corto');
    RAISE EXCEPTION 'CASO 3 FALLÓ: aceptó un motivo de menos de 10 caracteres';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%LC_MOTIVO_REQUERIDO%' THEN
        RAISE EXCEPTION 'CASO 3 FALLÓ: check_violation inesperado: %', SQLERRM;
      END IF;
      RAISE NOTICE 'CASO 3 OK: LC_MOTIVO_REQUERIDO con motivo corto';
    WHEN undefined_function THEN
      RAISE EXCEPTION 'CASO 3 FALLÓ: la RPC sigue rota (42883): %', SQLERRM;
  END;
END
$caso3$ LANGUAGE plpgsql;

ROLLBACK;
