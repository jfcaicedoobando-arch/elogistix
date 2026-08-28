-- =============================================================
-- fix3_crm_propagar_cross_vendedor.sql · FIX3 tanda 3 (M-1 / O7.7 H4)
--
-- crm_propagar_conversion_cliente (SECURITY DEFINER) ya no permite que un
-- vendedor propague la conversión de una oportunidad de OTRO vendedor
-- (fix de fondo en 20260828000300_rev4). Los LC_ de autorización viajan como
-- raise_exception (P0001) — el contrato es el prefijo del mensaje, que es lo
-- que traduce `lcCodeMessages`. Este test congela el comportamiento:
--   · CASO 1: vendedor A sobre oportunidad del vendedor B →
--     LC_OPORTUNIDAD_AJENA.
--   · CASO 2: el vendedor dueño SÍ propaga (camino feliz intacto).
--   · CASO 3: no pisa una conversión previa hacia OTRO cliente
--     (LC_OPORTUNIDAD_YA_CONVERTIDA).
--   · CASO 4: un rol gerencial de la org SÍ puede (gerente_comercial).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_crm_propagar_cross_vendedor.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := 'aa7aa7aa-0000-4000-8000-000000000010';
  v_vend_a uuid := 'aa7aa7aa-0000-4000-8000-0000000000a1';
  v_vend_b uuid := 'aa7aa7aa-0000-4000-8000-0000000000b1';
  v_gerente uuid := 'aa7aa7aa-0000-4000-8000-0000000000c1';
  v_etapa uuid := 'aa7aa7aa-0000-4000-8000-000000000020';
  v_cli_1 uuid := 'aa7aa7aa-0000-4000-8000-000000000031';
  v_cli_2 uuid := 'aa7aa7aa-0000-4000-8000-000000000032';
  v_op_b uuid := 'aa7aa7aa-0000-4000-8000-000000000041';
  v_op_b2 uuid := 'aa7aa7aa-0000-4000-8000-000000000042';
  v_res jsonb;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'TEST FIX3 CRM');

  -- v13.777.9: user_roles referencia auth.users; sembramos los usuarios en
  -- modo best-effort (en CI sin GoTrue el FK no existe y el bloque es un no-op).
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      (v_vend_a, 'fix3-crm-vend-a@test.local'),
      (v_vend_b, 'fix3-crm-vend-b@test.local'),
      (v_gerente, 'fix3-crm-gerente@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Membresías (el espejo membresía→user_roles replica los roles de ventas).
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
    (v_org, v_vend_a, 'vendedor'),
    (v_org, v_vend_b, 'vendedor'),
    (v_org, v_gerente, 'gerente_comercial');
  -- Por si el trigger espejo no cubre alguno (idempotente).
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_vend_a, 'vendedor'), (v_vend_b, 'vendedor'), (v_gerente, 'gerente_comercial')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.crm_etapas_pipeline (id, organization_id, nombre, tipo, orden, activa)
  VALUES (v_etapa, v_org, 'Cierre FIX3', 'abierta'::public.crm_etapa_tipo, 1, true);

  INSERT INTO public.clientes (id, organization_id, nombre) VALUES
    (v_cli_1, v_org, 'Cliente Uno FIX3'),
    (v_cli_2, v_org, 'Cliente Dos FIX3');

  INSERT INTO public.crm_oportunidades (id, organization_id, nombre, etapa_id, vendedor_id)
  VALUES (v_op_b, v_org, 'OP del vendedor B', v_etapa, v_vend_b),
         (v_op_b2, v_org, 'OP2 del vendedor B', v_etapa, v_vend_b);

  -- ----------------------------------------------------------
  -- CASO 1: vendedor A intenta propagar la oportunidad de B → 42501.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_vend_a);
  BEGIN
    PERFORM public.crm_propagar_conversion_cliente(v_op_b, v_cli_1, 'Cliente Uno FIX3');
    RAISE EXCEPTION 'CASO 1 FAIL: un vendedor propagó la conversión de una oportunidad AJENA';
  EXCEPTION
    -- La RPC levanta los LC_ de autorización sin ERRCODE explícito, así que
    -- llegan como raise_exception (P0001); el contrato que congelamos es el
    -- prefijo del mensaje, que es lo que el frontend traduce.
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_OPORTUNIDAD_AJENA%' THEN
        RAISE;
      END IF;
  END;
  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'CASO 1 OK · cross-vendedor rechazado con LC_OPORTUNIDAD_AJENA.';

  -- ----------------------------------------------------------
  -- CASO 2: el vendedor dueño propaga su propia oportunidad.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_vend_b);
  v_res := public.crm_propagar_conversion_cliente(v_op_b, v_cli_1, 'Cliente Uno FIX3');
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert(
    (v_res->>'cliente_id')::uuid = v_cli_1,
    'CASO 2: la propagación del dueño no devolvió el cliente esperado');
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE id = v_op_b AND cliente_id = v_cli_1),
    'CASO 2: la oportunidad no quedó ligada al cliente');
  RAISE NOTICE 'CASO 2 OK · el vendedor dueño propaga su propia oportunidad.';

  -- ----------------------------------------------------------
  -- CASO 3: ni el dueño puede pisar la conversión hacia OTRO cliente.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_vend_b);
  BEGIN
    PERFORM public.crm_propagar_conversion_cliente(v_op_b, v_cli_2, 'Cliente Dos FIX3');
    RAISE EXCEPTION 'CASO 3 FAIL: se pisó una conversión previa hacia otro cliente';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_OPORTUNIDAD_YA_CONVERTIDA%' THEN
        RAISE;
      END IF;
  END;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE id = v_op_b AND cliente_id = v_cli_1),
    'CASO 3: el cliente previo fue sobrescrito');
  RAISE NOTICE 'CASO 3 OK · conversión previa protegida (LC_OPORTUNIDAD_YA_CONVERTIDA).';

  -- ----------------------------------------------------------
  -- CASO 4: rol gerencial de la org sí puede sobre oportunidad ajena.
  -- ----------------------------------------------------------
  PERFORM pg_temp.as_user(v_gerente);
  v_res := public.crm_propagar_conversion_cliente(v_op_b2, v_cli_2, 'Cliente Dos FIX3');
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert(
    (v_res->>'cliente_id')::uuid = v_cli_2,
    'CASO 4: el gerente_comercial no pudo propagar la oportunidad de su org');
  RAISE NOTICE 'CASO 4 OK · gerente_comercial de la org autorizado.';
END $$;

ROLLBACK;
