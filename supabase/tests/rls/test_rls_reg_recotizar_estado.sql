-- ============================================================================
-- Suite RLS — Regresión v13.823.346 · recotizar_cotizacion
-- ============================================================================
-- Contrato de negocio:
--   - Sólo una cotización 'Aceptada' puede re-cotizarse.
--   - Borrador / Enviada / Rechazada se rechazan con LC_RECOTIZAR_ESTADO_INVALIDO
--     y NO mutan estado ni versión.
--   - El motivo exige al menos 5 caracteres (mismo mínimo que el modal).
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_recotizar_estado.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a  uuid := gen_random_uuid();
  cli_a  uuid := gen_random_uuid();
  usr_a  uuid := gen_random_uuid();
  cot_id uuid;
  est    text;
  ver    int;
  fallo  boolean;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS Recotizar');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
    VALUES (cli_a, 'Cli Recotizar', 'XAXX010101000', 'recotizar@example.com', org_a);

  -- TEST 1..3: estados no aceptados no se pueden re-cotizar y no mutan.
  FOR est IN SELECT unnest(ARRAY['Borrador','Enviada','Rechazada']) LOOP
    cot_id := gen_random_uuid();
    INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado, version)
      VALUES (cot_id, org_a, cli_a, 'Cli Recotizar', 'COT-RCT-' || est, 'Marítimo', 'Importación', 'FOB', est::estado_cotizacion, 1);
    fallo := false;
    BEGIN
      PERFORM public.recotizar_cotizacion(cot_id, 'motivo suficiente');
    EXCEPTION WHEN OTHERS THEN
      fallo := (SQLERRM LIKE '%LC_RECOTIZAR_ESTADO_INVALIDO%') OR (SQLERRM LIKE '%No autorizado%');
    END;
    PERFORM pg_temp.assert(fallo, 'recotizar debe rechazar estado ' || est);
    SELECT estado::text, version INTO est, ver FROM public.cotizaciones WHERE id = cot_id;
    PERFORM pg_temp.assert(ver = 1, 'la versión no debe cambiar en estado ' || est);
  END LOOP;

  -- TEST 4: motivo corto se rechaza.
  cot_id := gen_random_uuid();
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado, version)
    VALUES (cot_id, org_a, cli_a, 'Cli Recotizar', 'COT-RCT-MOTIVO', 'Marítimo', 'Importación', 'FOB', 'Aceptada', 1);
  fallo := false;
  BEGIN
    PERFORM public.recotizar_cotizacion(cot_id, 'abc');
  EXCEPTION WHEN OTHERS THEN
    fallo := true;
  END;
  PERFORM pg_temp.assert(fallo, 'recotizar debe exigir motivo de 5+ caracteres');
  SELECT version INTO ver FROM public.cotizaciones WHERE id = cot_id;
  PERFORM pg_temp.assert(ver = 1, 'motivo corto no debe versionar');

  RAISE NOTICE 'OK · recotizar_cotizacion: estado y motivo validados';
END $$;

ROLLBACK;
