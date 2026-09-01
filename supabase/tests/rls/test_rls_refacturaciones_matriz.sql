-- ============================================================================
-- Suite RLS — matriz tabla-vs-RPC en public.refacturaciones (Ola 14 · S05)
-- ============================================================================
-- Verifica la migración 20260814155024 (R5BD-04 y R5BD-05):
--   T1. Tesorero NO puede insertar directo (debe pasar por abrir_caso_refacturacion).
--   T2. Ejecutivo de cobranza NO puede insertar directo.
--   T3. Auxiliar contable SÍ puede insertar (las RPC ya lo autorizan).
--   T4. Tesorero NO puede actualizar (UPDATE afecta 0 filas por la USING).
--   T5. Auxiliar contable SÍ puede actualizar (1 fila).
--   T6. Cross-tenant: usuario de org B no lee ni escribe casos de org A.
--   T7. SELECT intacto para roles sin escritura (tesorero de la misma org sí lee).
--   T8. FK pagos_factura.refacturacion_id rechaza referencias colgantes (23503).
--   T9. La FK existe con ON DELETE RESTRICT y en estado NOT VALID (saneo pendiente).
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_refacturaciones_matriz.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  u_tesorero uuid := gen_random_uuid();   -- org A, tesorero  → sin escritura
  u_cobranza uuid := gen_random_uuid();   -- org A, cobranza  → sin escritura
  u_auxiliar uuid := gen_random_uuid();   -- org A, auxiliar_contable → con escritura
  u_org_b    uuid := gen_random_uuid();   -- org B, admin_org → aislado
  cli_a uuid := gen_random_uuid();
  cli_a2 uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_a2 uuid := gen_random_uuid();  -- T3: `uq_refacturaciones_original_abierta`
  fac_b uuid := gen_random_uuid();
  caso_a uuid := gen_random_uuid();
  v_rows int;
  v_count int;
  v_def text;
  v_valid boolean;
  v_sim jsonb;
  pago_a uuid := gen_random_uuid();

BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  BEGIN
    -- v13.821.3: `skip_auto_org` evita que el trigger de alta corone al
    -- primer usuario como super_admin en una base limpia (rompía los roles).
    INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
      (u_tesorero, 's05-tesorero@test.local', '{"skip_auto_org":"true"}'::jsonb),
      (u_cobranza, 's05-cobranza@test.local', '{"skip_auto_org":"true"}'::jsonb),
      (u_auxiliar, 's05-auxiliar@test.local', '{"skip_auto_org":"true"}'::jsonb),
      (u_org_b,    's05-orgb@test.local',     '{"skip_auto_org":"true"}'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- CI sin GoTrue: los FK contra auth.users ya no existen.
  END;

  INSERT INTO public.organizations(id, nombre) VALUES

    (org_a, 'RLS Refact A'), (org_b, 'RLS Refact B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_tesorero, 'tesorero'),
    (org_a, u_cobranza, 'ejecutivo_cobranza'),
    (org_a, u_auxiliar, 'auxiliar_contable'),
    (org_b, u_org_b,    'admin_org');

  -- No se siembra public.user_roles: estas policies resuelven el permiso por
  -- organization_members y sólo consultan has_role para 'super_admin'.

  -- v13.777.6 — `clientes.email` es NOT NULL desde la Ola 7 (normalización
  -- de correos); las inserciones de prueba deben traerlo.
  INSERT INTO public.clientes(id, organization_id, nombre, email) VALUES
    (cli_a,  org_a, 'Cliente Refact A',         'refact.a@test.local'),
    (cli_a2, org_a, 'Cliente Refact A destino', 'refact.a2@test.local'),
    (cli_b,  org_b, 'Cliente Refact B',         'refact.b@test.local');

  -- fac_a lleva UUID fiscal: T10-T12 le registran un REP y el guard
  -- `LC_REP_FACTURA_SIN_TIMBRAR` exige factura timbrada.
  INSERT INTO public.facturas(id, organization_id, cliente_id, numero, moneda, subtotal, iva, total, estado, uuid_fiscal) VALUES
    (fac_a, org_a, cli_a, 'S05-A-1', 'MXN', 1000, 160, 1160, 'Emitida', gen_random_uuid()::text),
    (fac_a2, org_a, cli_a, 'S05-A-2', 'MXN', 1000, 160, 1160, 'Emitida', NULL),
    (fac_b, org_b, cli_b, 'S05-B-1', 'MXN', 1000, 160, 1160, 'Emitida', NULL);


  -- Caso existente de org A, creado como postgres para probar UPDATE/SELECT.
  INSERT INTO public.refacturaciones
    (id, organization_id, factura_original_id, cliente_origen_id, cliente_destino_id, motivo)
  VALUES
    (caso_a, org_a, fac_a, cli_a, cli_a2, 'Seed S05');

  -- ── T1. Tesorero no puede insertar directo ───────────────────────────────
  PERFORM pg_temp.as_user(u_tesorero);
  PERFORM pg_temp.assert_insert_blocked(format($q$
    INSERT INTO public.refacturaciones
      (organization_id, factura_original_id, cliente_origen_id, cliente_destino_id, motivo)
    VALUES (%L, %L, %L, %L, 'T1 tesorero')
  $q$, org_a, fac_a, cli_a, cli_a2), 'T1 tesorero escribe refacturaciones');

  -- ── T4. Tesorero no puede actualizar (USING lo excluye → 0 filas) ────────
  UPDATE public.refacturaciones SET motivo = 'T4 tesorero' WHERE id = caso_a;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp.assert(v_rows = 0,
    format('T4 tesorero actualizó %s fila(s), esperaba 0', v_rows));

  -- ── T7. SELECT intacto para el tesorero de la misma org ──────────────────
  SELECT count(*) INTO v_count FROM public.refacturaciones WHERE id = caso_a;
  PERFORM pg_temp.assert(v_count = 1, 'T7 tesorero perdió la lectura de su org');

  -- ── T2. Ejecutivo de cobranza no puede insertar directo ──────────────────
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(u_cobranza);
  PERFORM pg_temp.assert_insert_blocked(format($q$
    INSERT INTO public.refacturaciones
      (organization_id, factura_original_id, cliente_origen_id, cliente_destino_id, motivo)
    VALUES (%L, %L, %L, %L, 'T2 cobranza')
  $q$, org_a, fac_a, cli_a, cli_a2), 'T2 cobranza escribe refacturaciones');

  -- ── T3 / T5. Auxiliar contable sí escribe y sí actualiza ─────────────────
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(u_auxiliar);
  INSERT INTO public.refacturaciones
    (organization_id, factura_original_id, cliente_origen_id, cliente_destino_id, motivo)
  -- Usa otra factura: sólo puede haber un caso abierto por factura original.
  VALUES (org_a, fac_a2, cli_a, cli_a2, 'T3 auxiliar');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp.assert(v_rows = 1, 'T3 auxiliar_contable NO pudo insertar');

  UPDATE public.refacturaciones SET motivo = 'T5 auxiliar' WHERE id = caso_a;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  PERFORM pg_temp.assert(v_rows = 1,
    format('T5 auxiliar_contable actualizó %s fila(s), esperaba 1', v_rows));

  -- ── T6. Cross-tenant cerrado ─────────────────────────────────────────────
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(u_org_b);
  SELECT count(*) INTO v_count FROM public.refacturaciones WHERE id = caso_a;
  PERFORM pg_temp.assert(v_count = 0, 'T6 org B leyó un caso de org A');

  PERFORM pg_temp.assert_insert_blocked(format($q$
    INSERT INTO public.refacturaciones
      (organization_id, factura_original_id, cliente_origen_id, cliente_destino_id, motivo)
    VALUES (%L, %L, %L, %L, 'T6 cross tenant')
  $q$, org_a, fac_a, cli_a, cli_a2), 'T6 org B escribe en org A');

  -- ── T8. FK rechaza refacturacion_id colgante ─────────────────────────────
  PERFORM pg_temp.as_postgres();
  BEGIN
    INSERT INTO public.pagos_factura
      (organization_id, factura_id, fecha_pago, monto, monto_aplicado_factura,
       moneda, refacturacion_id)
    VALUES (org_a, fac_a, current_date, 100, 100, 'MXN', gen_random_uuid());
    RAISE EXCEPTION 'RLS TEST FAIL: T8 la FK pagos_factura_refacturacion_fk NO bloqueó una referencia colgante';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL; -- esperado (23503)
  END;

  -- ── T9. La FK existe con la configuración documentada ────────────────────
  SELECT pg_get_constraintdef(oid), convalidated INTO v_def, v_valid
    FROM pg_constraint
   WHERE conrelid = 'public.pagos_factura'::regclass
     AND conname = 'pagos_factura_refacturacion_fk';
  PERFORM pg_temp.assert(v_def IS NOT NULL, 'T9 falta la FK pagos_factura_refacturacion_fk');
  PERFORM pg_temp.assert(v_def LIKE '%REFERENCES refacturaciones(id)%',
    format('T9 la FK no apunta a refacturaciones(id): %s', v_def));
  PERFORM pg_temp.assert(v_def LIKE '%ON DELETE RESTRICT%',
    format('T9 la FK perdió ON DELETE RESTRICT: %s', v_def));
  PERFORM pg_temp.assert(v_valid = false,
    'T9 la FK ya está VALIDATED: actualizar docs/ola14 y este test tras el saneo manual');

  -- ── T10 / T11. Vista previa: REP en verificación ante el SAT no bloquea ──
  -- Un REP vivo cuya cancelación ya se solicitó es un PENDIENTE, no un bloqueo
  -- (los pasos 2, 3 y 4 pueden avanzar mientras el SAT responde).
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.pagos_factura
    (id, organization_id, factura_id, fecha_pago, monto, monto_aplicado_factura,
     moneda, uuid_rep, rep_cancellation_status)
  VALUES (pago_a, org_a, fac_a, current_date, 1160, 1160, 'MXN',
          gen_random_uuid()::text, 'verifying');

  PERFORM pg_temp.as_user(u_auxiliar);
  v_sim := public.refacturacion_simular_paso(caso_a, 2);
  PERFORM pg_temp.assert(NOT (v_sim -> 'bloqueos' @> '["LC_REFACT_REP_VIVO"]'::jsonb),
    format('T10 el REP en verificación se reportó como bloqueo: %s', v_sim -> 'bloqueos'));
  PERFORM pg_temp.assert(v_sim -> 'pendientes' @> '["LC_REFACT_REP_EN_VERIFICACION"]'::jsonb,
    format('T10 falta el pendiente LC_REFACT_REP_EN_VERIFICACION: %s', v_sim -> 'pendientes'));

  v_sim := public.refacturacion_simular_paso(caso_a, 4);
  PERFORM pg_temp.assert(NOT (v_sim -> 'bloqueos' @> '["LC_REFACT_REP_VIVO"]'::jsonb),
    format('T11 el paso 4 bloqueó por un REP ya en verificación: %s', v_sim -> 'bloqueos'));
  PERFORM pg_temp.assert(v_sim -> 'pendientes' @> '["LC_REFACT_REP_EN_VERIFICACION"]'::jsonb,
    format('T11 el paso 4 no reportó el REP en verificación: %s', v_sim -> 'pendientes'));

  -- T12. Sin solicitud de cancelación el REP sí bloquea.
  PERFORM pg_temp.as_postgres();
  UPDATE public.pagos_factura SET rep_cancellation_status = 'none' WHERE id = pago_a;
  PERFORM pg_temp.as_user(u_auxiliar);
  v_sim := public.refacturacion_simular_paso(caso_a, 2);
  PERFORM pg_temp.assert(v_sim -> 'bloqueos' @> '["LC_REFACT_REP_VIVO"]'::jsonb,
    format('T12 un REP vivo sin solicitud NO bloqueó el paso 2: %s', v_sim -> 'bloqueos'));

  RAISE NOTICE 'OK — suite refacturaciones (matriz tabla-vs-RPC + FK + vista previa) sin fallos';

END $$;

ROLLBACK;
