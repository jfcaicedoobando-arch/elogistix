-- =============================================================
-- ola_p1_guards.sql · Ola P1 (auditoría estática 2026-09-08)
--
-- P1-1  `cancelar_liquidacion_comision` vigente debe autorizar por membresía
--       en la org dueña (`has_any_role_in_org_exact`), no por rol global.
-- P1-2  `credito_en_uso_mxn` convierte las NC a la moneda de la factura y
--       falla cerrado si una factura extranjera viva no tiene TC fiscal válido.
-- P1-3  idempotencia aislada por (key, organización, usuario) + validación de
--       la función; `idempotency_store` no pisa la fila de otro scope.
-- P1-4  `crear_embarque_completo` / `actualizar_embarque_completo` rechazan
--       cliente, cotización y proveedor de otra organización.
--
-- Todo dentro de BEGIN…ROLLBACK (no toca datos).
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola_p1_guards.sql
-- =============================================================

BEGIN;

-- ── Fixture: dos organizaciones y un usuario admin en la A ───────────────────
INSERT INTO public.organizations (id, nombre) VALUES
  ('11110000-0000-4000-8000-000000000001'::uuid, 'P1 Org A'),
  ('22220000-0000-4000-8000-000000000002'::uuid, 'P1 Org B');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('11110000-0000-4000-8000-0000000000a1', 'p1-admin-a@test.mx'),
      ('22220000-0000-4000-8000-0000000000b1', 'p1-admin-b@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('11110000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-0000000000a1', 'admin_org'::public.app_role),
  ('22220000-0000-4000-8000-000000000002'::uuid,
   '22220000-0000-4000-8000-0000000000b1', 'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
  ('11110000-0000-4000-8000-0000000000c1'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'Cliente A', 'p1-cliente-a@test.mx'),
  ('22220000-0000-4000-8000-0000000000c2'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'Cliente B', 'p1-cliente-b@test.mx');

INSERT INTO public.proveedores (id, organization_id, nombre, tipo) VALUES
  ('22220000-0000-4000-8000-0000000000d2'::uuid,
   '22220000-0000-4000-8000-000000000002'::uuid, 'Proveedor B', 'Naviera'::tipo_proveedor);

-- -------------------------------------------------------------
-- P1-1: la definición vigente autoriza por org, no por rol global
-- -------------------------------------------------------------
DO $p1_1$
DECLARE
  d text := pg_get_functiondef('public.cancelar_liquidacion_comision(uuid, text)'::regprocedure);
BEGIN
  IF position('has_any_role_in_org_exact' in d) = 0 THEN
    RAISE EXCEPTION 'P1-1 FALLO: cancelar_liquidacion_comision no autoriza por organización (regresión de YG-02)';
  END IF;
  IF position('FROM public.user_roles ur' in d) > 0 THEN
    RAISE EXCEPTION 'P1-1 FALLO: cancelar_liquidacion_comision volvió al rol GLOBAL vía user_roles';
  END IF;
  RAISE NOTICE '✓ P1-1: autorización por membresía en la org dueña';
END
$p1_1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- P1-2: aritmética multimoneda y fail-closed del crédito en uso
-- -------------------------------------------------------------
SET LOCAL session_replication_role = replica; -- fixture puro de lectura

INSERT INTO public.facturas
  (id, organization_id, cliente_id, numero, cliente_nombre, moneda, tipo_cambio,
   subtotal, total, estado, fecha_emision, fecha_vencimiento)
VALUES
  -- Caso A: factura MXN 18,000 con NC USD 100 @18 ⇒ 18,000 − 1,800 = 16,200
  ('11110000-0000-4000-8000-0000000000f1'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-0000000000c1'::uuid,
   'P1-A', 'Cliente A', 'MXN'::moneda, 1, 18000, 18000,
   'Emitida'::estado_factura, CURRENT_DATE, CURRENT_DATE + 30);

INSERT INTO public.factura_notas_credito
  (id, organization_id, factura_id, folio, moneda, tipo_cambio, monto, estado,
   fecha_emision, motivo, descripcion)
VALUES
  ('11110000-0000-4000-8000-0000000000e1'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-0000000000f1'::uuid,
   'NC-A', 'USD'::moneda, 18, 100, 'Aplicada'::estado_nota_credito, CURRENT_DATE,
   'Descuento'::motivo_nota_credito, 'Prueba P1-2');

DO $p1_2a$
DECLARE v numeric;
BEGIN
  v := public.credito_en_uso_mxn('11110000-0000-4000-8000-0000000000c1'::uuid);
  IF v <> 16200 THEN
    RAISE EXCEPTION 'P1-2 FALLO (MXN + NC USD): esperado 16200, obtuvo %', v;
  END IF;
  RAISE NOTICE '✓ P1-2: factura MXN 18,000 − NC USD 100 @18 = 16,200';
END
$p1_2a$ LANGUAGE plpgsql;

-- Caso inverso: factura USD 1,000 @18 con NC MXN 1,800 ⇒ (1,000 − 100) × 18
UPDATE public.facturas
   SET moneda = 'USD'::moneda, tipo_cambio = 18, subtotal = 1000, total = 1000
 WHERE id = '11110000-0000-4000-8000-0000000000f1'::uuid;
UPDATE public.factura_notas_credito
   SET moneda = 'MXN'::moneda, tipo_cambio = 1, monto = 1800
 WHERE id = '11110000-0000-4000-8000-0000000000e1'::uuid;

DO $p1_2b$
DECLARE v numeric;
BEGIN
  v := public.credito_en_uso_mxn('11110000-0000-4000-8000-0000000000c1'::uuid);
  IF v <> 16200 THEN
    RAISE EXCEPTION 'P1-2 FALLO (USD + NC MXN): esperado 16200, obtuvo %', v;
  END IF;
  RAISE NOTICE '✓ P1-2: factura USD 1,000 @18 − NC MXN 1,800 = 16,200';
END
$p1_2b$ LANGUAGE plpgsql;

-- Legacy extranjera con TC null / 1 / fuera de banda ⇒ fail-closed
-- (TC = 0 es imposible: lo bloquea el CHECK facturas_tipo_cambio_pos)
DO $p1_2c$
DECLARE
  tc numeric;
  v numeric;
BEGIN
  FOREACH tc IN ARRAY ARRAY[NULL, 1, 200]::numeric[] LOOP
    UPDATE public.facturas SET tipo_cambio = tc
     WHERE id = '11110000-0000-4000-8000-0000000000f1'::uuid;
    BEGIN
      v := public.credito_en_uso_mxn('11110000-0000-4000-8000-0000000000c1'::uuid);
      RAISE EXCEPTION 'P1-2 FALLO: TC % devolvió % en vez de bloquear', COALESCE(tc, -1), v;
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM NOT LIKE 'LC_CREDITO_TC_INVALIDO%' THEN
        RAISE EXCEPTION 'P1-2 FALLO: error inesperado %', SQLERRM;
      END IF;
    END;
  END LOOP;
  RAISE NOTICE '✓ P1-2: TC null/1/fuera de banda ⇒ crédito no verificable (fail-closed)';
END
$p1_2c$ LANGUAGE plpgsql;

-- MXN intacto: sin NC ni pagos la exposición es el total
UPDATE public.facturas
   SET moneda = 'MXN'::moneda, tipo_cambio = 1, subtotal = 5000, iva = 0, total = 5000
 WHERE id = '11110000-0000-4000-8000-0000000000f1'::uuid;
UPDATE public.factura_notas_credito SET estado = 'Cancelada'::estado_nota_credito
 WHERE id = '11110000-0000-4000-8000-0000000000e1'::uuid;

DO $p1_2d$
DECLARE v numeric;
BEGIN
  v := public.credito_en_uso_mxn('11110000-0000-4000-8000-0000000000c1'::uuid);
  IF v <> 5000 THEN
    RAISE EXCEPTION 'P1-2 FALLO (MXN puro): esperado 5000, obtuvo %', v;
  END IF;
  RAISE NOTICE '✓ P1-2: MXN sin NC = total (sin cambios de comportamiento)';
END
$p1_2d$ LANGUAGE plpgsql;

SET LOCAL session_replication_role = origin;

-- -------------------------------------------------------------
-- P1-3: idempotencia aislada por (key, organización, usuario)
-- -------------------------------------------------------------
DO $p1_3b$

DECLARE
  k uuid := '99990000-0000-4000-8000-000000000099'::uuid;
  r jsonb;
  n int;
BEGIN
  -- Usuario A (org A) reclama y guarda su respuesta.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '11110000-0000-4000-8000-0000000000a1')::text, true);
  IF public.idempotency_claim(k, 'demo_fn') IS NOT NULL THEN
    RAISE EXCEPTION 'P1-3 FALLO: primer claim de A no debía devolver replay';
  END IF;
  PERFORM public.idempotency_store(k, jsonb_build_object('dueño', 'A'));

  -- Usuario B (org B) con la MISMA key: no colisiona ni ve la respuesta de A.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '22220000-0000-4000-8000-0000000000b1')::text, true);
  IF public.idempotency_claim(k, 'demo_fn') IS NOT NULL THEN
    RAISE EXCEPTION 'P1-3 FALLO: la key de A bloqueó/filtró a B';
  END IF;
  PERFORM public.idempotency_store(k, jsonb_build_object('dueño', 'B'));

  SELECT count(*) INTO n FROM public.idempotency_keys WHERE key = k;
  IF n <> 2 THEN
    RAISE EXCEPTION 'P1-3 FALLO: se esperaban 2 filas aisladas, hay %', n;
  END IF;

  SELECT response INTO r FROM public.idempotency_keys
   WHERE key = k AND user_id = '11110000-0000-4000-8000-0000000000a1';
  IF r->>'dueño' <> 'A' THEN
    RAISE EXCEPTION 'P1-3 FALLO: el store de B sobrescribió la respuesta de A (%)', r;
  END IF;

  -- Replay legítimo de B.
  r := public.idempotency_claim(k, 'demo_fn');
  IF r->>'dueño' <> 'B' THEN
    RAISE EXCEPTION 'P1-3 FALLO: replay legítimo de B no devolvió su respuesta (%)', r;
  END IF;

  -- Misma key para OTRA función ⇒ rechazo explícito, nunca replay ajeno.
  BEGIN
    PERFORM public.idempotency_claim(k, 'otra_fn');
    RAISE EXCEPTION 'P1-3 FALLO: se aceptó la misma key para otra función';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE 'LC_IDEMPOTENCIA_FN_DISTINTA%' THEN
      RAISE EXCEPTION 'P1-3 FALLO: error inesperado %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ P1-3: idempotencia aislada por org+usuario+función';
END
$p1_3b$ LANGUAGE plpgsql;

-- Grants reducidos: `anon` no toca la tabla y `authenticated` no borra.
DO $p1_3c$
BEGIN
  IF has_table_privilege('anon', 'public.idempotency_keys', 'SELECT')
     OR has_table_privilege('anon', 'public.idempotency_keys', 'INSERT') THEN
    RAISE EXCEPTION 'P1-3 FALLO: anon sigue con acceso directo a idempotency_keys';
  END IF;
  IF has_table_privilege('authenticated', 'public.idempotency_keys', 'DELETE') THEN
    RAISE EXCEPTION 'P1-3 FALLO: authenticated puede borrar idempotency_keys';
  END IF;
  RAISE NOTICE '✓ P1-3: grants directos reducidos';
END
$p1_3c$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- P1-4: relaciones cross-org rechazadas en crear/actualizar
-- -------------------------------------------------------------
DO $p1_4$
DECLARE
  v_base jsonb := jsonb_build_object(
    'expediente', 'ELIMP9001', 'modo', 'Marítimo', 'tipo', 'Importación',
    'cliente_nombre', 'Cliente A');
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '11110000-0000-4000-8000-0000000000a1')::text, true);

  -- Cliente de otra organización
  BEGIN
    PERFORM public.crear_embarque_completo(
      v_base || jsonb_build_object('cliente_id', '22220000-0000-4000-8000-0000000000c2'));
    RAISE EXCEPTION 'P1-4 FALLO: se creó un embarque con cliente de otra org';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_EMB_CLIENTE_INVALIDO%' THEN
      RAISE EXCEPTION 'P1-4 FALLO: error inesperado (cliente) %', SQLERRM;
    END IF;
  END;

  -- Proveedor de otra organización en los costos
  BEGIN
    PERFORM public.crear_embarque_completo(
      v_base || jsonb_build_object('cliente_id', '11110000-0000-4000-8000-0000000000c1'),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'concepto', 'Flete', 'moneda', 'MXN', 'monto', 100,
        'proveedor_id', '22220000-0000-4000-8000-0000000000d2')));
    RAISE EXCEPTION 'P1-4 FALLO: se creó un embarque con proveedor de otra org';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_EMB_PROVEEDOR_INVALIDO%' THEN
      RAISE EXCEPTION 'P1-4 FALLO: error inesperado (proveedor) %', SQLERRM;
    END IF;
  END;

  -- Cotización inexistente en la org
  BEGIN
    PERFORM public.crear_embarque_completo(
      v_base || jsonb_build_object(
        'cliente_id', '11110000-0000-4000-8000-0000000000c1',
        'cotizacion_id', '22220000-0000-4000-8000-0000000000cc'));
    RAISE EXCEPTION 'P1-4 FALLO: se creó un embarque con cotización ajena';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_EMB_COTIZACION_INVALIDA%' THEN
      RAISE EXCEPTION 'P1-4 FALLO: error inesperado (cotización) %', SQLERRM;
    END IF;
  END;

  -- Nada se escribió
  IF EXISTS (SELECT 1 FROM public.embarques WHERE expediente = 'ELIMP9001') THEN
    RAISE EXCEPTION 'P1-4 FALLO: quedó un embarque a medias tras el rechazo';
  END IF;

  -- Caso válido: cliente propio, sin cotización ni proveedores
  PERFORM public.crear_embarque_completo(
    v_base || jsonb_build_object(
      'expediente', 'ELIMP9002',
      'cliente_id', '11110000-0000-4000-8000-0000000000c1'));
  IF NOT EXISTS (SELECT 1 FROM public.embarques WHERE expediente = 'ELIMP9002') THEN
    RAISE EXCEPTION 'P1-4 FALLO: el caso válido dejó de funcionar';
  END IF;

  -- Actualizar apuntando a un cliente ajeno ⇒ rechazo sin cambios
  BEGIN
    PERFORM public.actualizar_embarque_completo(
      (SELECT id FROM public.embarques WHERE expediente = 'ELIMP9002'),
      jsonb_build_object('cliente_id', '22220000-0000-4000-8000-0000000000c2'));
    RAISE EXCEPTION 'P1-4 FALLO: se actualizó a un cliente de otra org';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_EMB_CLIENTE_INVALIDO%' THEN
      RAISE EXCEPTION 'P1-4 FALLO: error inesperado (update cliente) %', SQLERRM;
    END IF;
  END;

  IF EXISTS (
    SELECT 1 FROM public.embarques
     WHERE expediente = 'ELIMP9002'
       AND cliente_id = '22220000-0000-4000-8000-0000000000c2'::uuid
  ) THEN
    RAISE EXCEPTION 'P1-4 FALLO: el update cross-org sí escribió';
  END IF;

  RAISE NOTICE '✓ P1-4: relaciones cross-org rechazadas en crear y actualizar';
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$p1_4$ LANGUAGE plpgsql;

ROLLBACK;
