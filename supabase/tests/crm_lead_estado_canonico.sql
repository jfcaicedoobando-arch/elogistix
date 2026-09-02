-- =============================================================
-- crm_lead_estado_canonico.sql · v13.823.62
--
-- Congela SÓLO lo crítico del guard `guard_crm_lead_estado_canonico`:
--   1) authenticated no puede INSERT con estado derivado.
--   2) authenticated no puede cambiar el estado a un derivado.
--   3) authenticated no puede sacar un lead de un estado derivado.
--   4) manual → manual sigue permitido.
--   5) guardar OTROS campos conservando un estado derivado sigue permitido.
--   6) crm_calificar_prospecto (SECURITY DEFINER, owner postgres) sigue
--      pudiendo producir 'Prospecto'.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/crm_lead_estado_canonico.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

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
      RAISE EXCEPTION 'FALLO %: esperaba % y llegó «%»', _caso, _codigo, v_msg;
    END IF;
  END;
  IF v_permitido THEN
    RAISE EXCEPTION 'FALLO %: esperaba % y la operación fue permitida', _caso, _codigo;
  END IF;
END;
$$;

-- ===== Invariantes de definición del guard =====
DO $$
DECLARE r record;
BEGIN
  SELECT p.prosecdef, p.proconfig INTO r
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'guard_crm_lead_estado_canonico';
  PERFORM pg_temp.assert(r IS NOT NULL, 'G0: debe existir guard_crm_lead_estado_canonico');
  PERFORM pg_temp.assert(NOT r.prosecdef,
    'G1: el guard debe ser SECURITY INVOKER (si fuese DEFINER nunca vería a authenticated)');
  PERFORM pg_temp.assert('search_path=public' = ANY (COALESCE(r.proconfig, ARRAY[]::text[])),
    'G2: el guard debe fijar search_path=public');

  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM pg_trigger t
             WHERE t.tgrelid = 'public.crm_leads'::regclass
               AND t.tgname = 'trg_guard_crm_lead_estado_canonico'
               AND NOT t.tgisinternal
               -- ROW (1) + BEFORE (2) + INSERT (4) + UPDATE (16)
               AND (t.tgtype & 1) = 1
               AND (t.tgtype & 2) = 2
               AND (t.tgtype & 4) = 4
               AND (t.tgtype & 16) = 16),
    'G3: el trigger debe ser BEFORE INSERT OR UPDATE FOR EACH ROW en crm_leads');

  PERFORM pg_temp.assert(
    (SELECT array_length(tgattr::int2[], 1) FROM pg_trigger
      WHERE tgrelid = 'public.crm_leads'::regclass
        AND tgname = 'trg_guard_crm_lead_estado_canonico') = 1,
    'G4: el UPDATE debe restringirse a la columna estado (UPDATE OF estado)');
END;
$$;

-- ===== Comportamiento =====
DO $$
DECLARE
  v_org      uuid := 'ce00ce00-0000-4000-8000-0000000000a1';
  v_gerente  uuid := 'ce00ce00-0000-4000-8000-0000000000b1';
  v_vend     uuid := 'ce00ce00-0000-4000-8000-0000000000b2';
  v_manual   uuid := 'ce00ce00-0000-4000-8000-0000000000c1';
  v_derivado uuid := 'ce00ce00-0000-4000-8000-0000000000c2';
  v_icp      uuid := 'ce00ce00-0000-4000-8000-0000000000c3';
  v_estado   text;
  v_empresa  text;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_gerente, 'estado-gerente@test.local'),
    (v_vend,    'estado-vendedor@test.local');
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST ORG ESTADO CANONICO');
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org, v_gerente, 'gerente_comercial'),
    (v_org, v_vend,    'vendedor');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_gerente, 'gerente_comercial'), (v_vend, 'vendedor')
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Lead manual y lead ya derivado (sembrados como postgres: el guard no aplica).
  INSERT INTO public.crm_leads (id, organization_id, empresa, estado, vendedor_id) VALUES
    (v_manual,   v_org, 'Lead manual',   'Contactado', v_gerente),
    (v_derivado, v_org, 'Lead derivado', 'Prospecto',  v_gerente);

  -- Lead con perfil ICP completo para la calificación canónica.
  INSERT INTO public.crm_leads (
    id, organization_id, empresa, estado, vendedor_id,
    sector, mercancia, rutas, volumen, frecuencia, dolor_explicito, proveedor_actual
  ) VALUES (
    v_icp, v_org, 'Lead ICP completo', 'Contactado', v_gerente,
    'Manufactura', 'Refacciones', 'CN-MX', '2 contenedores', 'Mensual',
    'Demoras en aduana', 'Otro forwarder');

  PERFORM pg_temp.as_user(v_gerente);

  -- 1) INSERT directo con estado derivado → rechazado.
  PERFORM pg_temp.espera_lc(
    format($q$INSERT INTO public.crm_leads (organization_id, empresa, estado, vendedor_id)
              VALUES (%L, 'Lead colado', 'Prospecto', %L)$q$, v_org, v_gerente),
    'LC_LEAD_ESTADO_DERIVADO', 'C1 INSERT con estado derivado');

  -- 1b) INSERT con estado manual → permitido.
  INSERT INTO public.crm_leads (organization_id, empresa, estado, vendedor_id)
  VALUES (v_org, 'Lead nuevo legítimo', 'Nuevo', v_gerente);

  -- 2) UPDATE manual → derivado → rechazado.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_leads SET estado = %L WHERE id = %L', 'Prospecto', v_manual),
    'LC_LEAD_ESTADO_DERIVADO', 'C2 manual → derivado');
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_leads SET estado = %L WHERE id = %L', 'Convertido', v_manual),
    'LC_LEAD_ESTADO_DERIVADO', 'C2b manual → Convertido');

  -- 3) UPDATE derivado → manual (sacarlo a mano) → rechazado.
  PERFORM pg_temp.espera_lc(
    format('UPDATE public.crm_leads SET estado = %L WHERE id = %L', 'Contactado', v_derivado),
    'LC_LEAD_ESTADO_DERIVADO', 'C3 derivado → manual');

  -- 4) manual → manual → permitido.
  UPDATE public.crm_leads SET estado = 'Descalificado' WHERE id = v_manual;

  -- 5) Editar otros campos conservando el estado derivado → permitido.
  UPDATE public.crm_leads SET empresa = 'Lead derivado (editado)' WHERE id = v_derivado;
  UPDATE public.crm_leads
     SET empresa = 'Lead derivado (editado 2)', estado = 'Prospecto'
   WHERE id = v_derivado;

  PERFORM pg_temp.as_postgres();
  SELECT estado::text INTO v_estado FROM public.crm_leads WHERE id = v_manual;
  PERFORM pg_temp.assert(v_estado = 'Descalificado',
    format('C4: manual → manual debe persistir (actual=%s)', v_estado));
  SELECT estado::text, empresa INTO v_estado, v_empresa
    FROM public.crm_leads WHERE id = v_derivado;
  PERFORM pg_temp.assert(v_estado = 'Prospecto',
    format('C5: el estado derivado no debe cambiar (actual=%s)', v_estado));
  PERFORM pg_temp.assert(v_empresa = 'Lead derivado (editado 2)',
    format('C5b: los demás campos del lead derivado deben poder guardarse (actual=%s)', v_empresa));

  -- 6) El escritor canónico sigue produciendo 'Prospecto'.
  PERFORM pg_temp.as_user(v_gerente);
  PERFORM public.crm_calificar_prospecto(v_icp);
  PERFORM pg_temp.as_postgres();
  SELECT estado::text INTO v_estado FROM public.crm_leads WHERE id = v_icp;
  PERFORM pg_temp.assert(v_estado = 'Prospecto',
    format('C6: crm_calificar_prospecto debe seguir dejando Prospecto (actual=%s)', v_estado));
END;
$$;

ROLLBACK;
