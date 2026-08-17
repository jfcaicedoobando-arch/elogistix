-- =============================================================
-- normalizar_razon_social_unicode.sql · VB-01 (patch-23)
--
-- Test anti-mojibake del trigger `_normalizar_razon_social`
-- (clientes/proveedores). La versión previa usaba `upper()` a
-- secas: con locale C/POSIX es ASCII-only y corrompe acentos
-- ("Bajío" → "BAJíO"). El fix fuerza collation ICU Unicode.
--
-- Casos:
--   · minúsculas acentuadas suben a mayúsculas (í→Í, ó→Ó, ñ→Ñ)
--   · el resultado nunca contiene marcadores de mojibake (Ã)
--   · espacios colapsados y extremos recortados
--
-- Corre en CI como paso del workflow rls-tests. Fixture en
-- BEGIN…ROLLBACK: no ensucia el snapshot.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/normalizar_razon_social_unicode.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := '11111111-1111-1111-1111-111111111111';
  v_cli uuid := '22222222-2222-2222-2222-222222222223';
  v_prv uuid := '22222222-2222-2222-2222-222222222224';
  v_nombre text;
BEGIN
  INSERT INTO public.organizations (id, nombre)
  VALUES (v_org, 'Test Org Mojibake') ON CONFLICT (id) DO NOTHING;

  -- CASO 1: acentos y eñe suben a mayúsculas Unicode.
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Comercializadora del Bajío SA de CV', 'XAXX010101000', 'moji@test.mx')
  RETURNING nombre INTO v_nombre;

  IF v_nombre <> 'COMERCIALIZADORA DEL BAJÍO SA DE CV' THEN
    RAISE EXCEPTION 'VB-01 CASO 1 falló: nombre = %', v_nombre;
  END IF;
  IF v_nombre LIKE '%Ã%' THEN
    RAISE EXCEPTION 'VB-01 CASO 1 falló: mojibake (Ã) en nombre = %', v_nombre;
  END IF;

  -- CASO 2: eñe y diéresis en proveedores + colapso de espacios.
  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prv, v_org, '  Electrónica   Pacífico  Niño Müller  ', 'GastoOperativo', 'Otros')
  RETURNING nombre INTO v_nombre;

  IF v_nombre <> 'ELECTRÓNICA PACÍFICO NIÑO MÜLLER' THEN
    RAISE EXCEPTION 'VB-01 CASO 2 falló: nombre = %', v_nombre;
  END IF;
  IF v_nombre LIKE '%Ã%' THEN
    RAISE EXCEPTION 'VB-01 CASO 2 falló: mojibake (Ã) en nombre = %', v_nombre;
  END IF;
END;
$fixture$;

ROLLBACK;
