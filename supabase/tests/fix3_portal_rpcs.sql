-- ============================================================================
-- fix3 (tanda 3) — RPCs del portal: TOCTOU, caps de longitud y rate limits.
--
-- Cubre las migraciones:
--   · 20260831200200 (portal_responder_por_token: FOR UPDATE + CAS +
--     motivo ≤ 1000 + bitácora con sentinel NOT NULL)
--   · 20260831200300 (portal_solicitar_cotizacion: check_ratelimit 10/hora
--     por cliente+usuario y caps 200/200/2000/2000)
--   · 20260831200400 (portal_obtener_proforma_por_token: check_ratelimit
--     30/min restaurado tras el drift BL-11)
--
--   1. Asserts estáticos sobre el cuerpo de cada función (anti-drift).
--   2. responder: aceptar → segunda respuesta falla; motivo se trunca a
--      1000; rechazo sin motivo falla.
--   3. solicitar: caps aplicados; la 11ª solicitud en la hora cae por
--      rate limit.
--   4. obtener: token inválido; link expirado sólo id/numero (BL-11
--      intacto); la 31ª lectura en el minuto cae por rate limit.
--      NOTA: no se ejercita el path "activo" porque está roto desde antes
--      de esta tanda (la función referencia columnas inexistentes
--      moneda/subtotal/iva/total; la tabla sólo tiene *_mxn/_usd — drift
--      pre-existente reportado aparte, fuera del alcance fix3).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_portal_rpcs.sql
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- ── 1. Asserts estáticos (anti-drift) ──────────────────────────────────────
DO $$
DECLARE
  v_responder text := pg_get_functiondef('public.portal_responder_por_token(uuid,text,text)'::regprocedure);
  v_solicitar text := pg_get_functiondef('public.portal_solicitar_cotizacion(uuid,modo_transporte,tipo_operacion,text,text,text,text,text,text)'::regprocedure);
  v_obtener   text := pg_get_functiondef('public.portal_obtener_proforma_por_token(uuid)'::regprocedure);
BEGIN
  IF v_responder !~* 'FOR UPDATE' THEN
    RAISE EXCEPTION 'FIX3 FAIL: portal_responder_por_token sin FOR UPDATE (TOCTOU)';
  END IF;
  IF v_responder !~* 'AND\s+estado_cliente\s*=\s*''pendiente''' THEN
    RAISE EXCEPTION 'FIX3 FAIL: portal_responder_por_token sin CAS estado_cliente en el UPDATE';
  END IF;
  IF v_responder !~* 'LEFT\(btrim' OR v_responder !~* '1000' THEN
    RAISE EXCEPTION 'FIX3 FAIL: portal_responder_por_token sin cap de motivo (LEFT(btrim(...),1000))';
  END IF;
  IF v_solicitar !~* 'check_ratelimit' THEN
    RAISE EXCEPTION 'FIX3 FAIL: portal_solicitar_cotizacion sin check_ratelimit';
  END IF;
  IF v_obtener !~* 'check_ratelimit' THEN
    RAISE EXCEPTION 'FIX3 FAIL: portal_obtener_proforma_por_token sin check_ratelimit (drift BL-11)';
  END IF;
  RAISE NOTICE 'FIX3 estáticos OK — FOR UPDATE/CAS/cap/ratelimits presentes';
END $$;

-- ── 2. portal_responder_por_token ──────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_tk1 uuid := gen_random_uuid();
  v_tk2 uuid := gen_random_uuid();
  v_tk3 uuid := gen_random_uuid();
  v_estado text;
  v_motivo_len int;
  v_err text;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'FIX3 RPC Org');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (v_cli, v_org, 'Cliente FIX3 RPC', 'XAXX010101E20', 'fix3rpc@test.local');

  INSERT INTO public.proformas(organization_id, numero, cliente_id, cliente_nombre, expediente,
                               token_publico, token_expira_at, estado_cliente, estado_proforma)
  VALUES
    (v_org, 'PF-FIX3-1', v_cli, 'Cliente FIX3 RPC', 'ELRPC00001', v_tk1, now() + interval '30 days', 'pendiente', 'pendiente'),
    (v_org, 'PF-FIX3-2', v_cli, 'Cliente FIX3 RPC', 'ELRPC00002', v_tk2, now() + interval '30 days', 'pendiente', 'pendiente'),
    (v_org, 'PF-FIX3-3', v_cli, 'Cliente FIX3 RPC', 'ELRPC00003', v_tk3, now() + interval '30 days', 'pendiente', 'pendiente');

  -- 2a. Aceptar funciona…
  PERFORM public.portal_responder_por_token(v_tk1, 'aceptada');
  SELECT estado_cliente INTO v_estado FROM public.proformas WHERE token_publico = v_tk1;
  PERFORM pg_temp.assert(v_estado = 'aceptada', 'responder: la aceptación no quedó persistida');

  -- 2b. …y una segunda respuesta (la del perdedor de la carrera) falla.
  --     OJO: no usar RAISE dentro del bloque try (su propio handler lo
  --     atraparía); se captura el mensaje y se verifica con assert.
  v_err := NULL;
  BEGIN
    PERFORM public.portal_responder_por_token(v_tk1, 'rechazada', 'llegué tarde');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  PERFORM pg_temp.assert(v_err LIKE '%ya fue respondida%',
    'responder: segunda respuesta NO fue rechazada (err: ' || COALESCE(v_err, '(sin error)') || ')');
  SELECT estado_cliente INTO v_estado FROM public.proformas WHERE token_publico = v_tk1;
  PERFORM pg_temp.assert(v_estado = 'aceptada',
    'responder: la segunda respuesta pisó la primera (TOCTOU sigue abierto)');

  -- 2c. El motivo queda truncado a 1000 caracteres.
  PERFORM public.portal_responder_por_token(v_tk2, 'rechazada', repeat('x', 5000));
  SELECT length(motivo_rechazo) INTO v_motivo_len FROM public.proformas WHERE token_publico = v_tk2;
  PERFORM pg_temp.assert(v_motivo_len = 1000,
    'responder: motivo sin cap; quedó con ' || v_motivo_len || ' caracteres');

  -- 2d. Rechazo sin motivo sigue siendo obligatorio.
  v_err := NULL;
  BEGIN
    PERFORM public.portal_responder_por_token(v_tk3, 'rechazada', '   ');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  PERFORM pg_temp.assert(v_err LIKE '%motivo%',
    'responder: rechazo sin motivo NO fue rechazado (err: ' || COALESCE(v_err, '(sin error)') || ')');
  RAISE NOTICE 'FIX3 responder OK — CAS, cap de motivo y motivo obligatorio';
END $$;

-- ── 3. portal_solicitar_cotizacion ─────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_u   uuid := gen_random_uuid();
  v_origen_len int;
  v_desc_len int;
  v_notas_len int;
  v_id uuid;
  i int;
  v_limited boolean := false;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'FIX3 COT Org');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (v_cli, v_org, 'Cliente FIX3 COT', 'XAXX010101E21', 'fix3cot@test.local');
  -- v13.777.9: client_users referencia auth.users; siembra best-effort.
  BEGIN
    INSERT INTO auth.users(id, email) VALUES (v_u, 'fix3-portal-rpcs@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.client_users(user_id, cliente_id, organization_id) VALUES
    (v_u, v_cli, v_org);

  PERFORM pg_temp.as_user(v_u);

  -- 3a. Caps de longitud (origen/destino 200, descripcion/notas 2000).
  SELECT c.id INTO v_id
  FROM public.portal_solicitar_cotizacion(
    v_cli, 'Marítimo', 'Importación',
    repeat('O', 500), repeat('D', 500), 'FCL', '40HC',
    repeat('M', 5000), repeat('N', 5000)
  ) c;
  SELECT length(origen), length(descripcion_mercancia),
         length(notas) - length(E'[Solicitud desde portal del cliente]\n')
    INTO v_origen_len, v_desc_len, v_notas_len
  FROM public.cotizaciones WHERE id = v_id;
  PERFORM pg_temp.assert(v_origen_len = 200, 'solicitar: origen sin cap 200 (' || v_origen_len || ')');
  PERFORM pg_temp.assert(v_desc_len = 2000, 'solicitar: descripcion sin cap 2000 (' || v_desc_len || ')');
  PERFORM pg_temp.assert(v_notas_len = 2000, 'solicitar: notas sin cap 2000 (' || v_notas_len || ')');

  -- 3b. Rate limit: 10/hora por (cliente, usuario). Ya consumimos 1; 9 más
  -- deben pasar y la 11ª debe caer.
  FOR i IN 1..9 LOOP
    PERFORM c.folio FROM public.portal_solicitar_cotizacion(
      v_cli, 'Marítimo', 'Importación', 'Veracruz', 'Manzanillo'
    ) c;
  END LOOP;
  BEGIN
    PERFORM c.folio FROM public.portal_solicitar_cotizacion(
      v_cli, 'Marítimo', 'Importación', 'Veracruz', 'Manzanillo'
    ) c;
  EXCEPTION WHEN raise_exception THEN
    v_limited := true;
  END;
  PERFORM pg_temp.assert(v_limited, 'solicitar: la 11ª solicitud en la hora NO cayó por rate limit');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'FIX3 solicitar OK — caps aplicados y 10/hora por cliente+usuario';
END $$;

-- ── 4. portal_obtener_proforma_por_token ───────────────────────────────────
DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_tk_activo  uuid := gen_random_uuid();
  v_tk_expira  uuid := gen_random_uuid();
  v_res jsonb;
  i int;
  v_limited boolean := false;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'FIX3 OBT Org');
  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (v_cli, v_org, 'Cliente FIX3 OBT', 'XAXX010101E22', 'fix3obt@test.local');
  INSERT INTO public.proformas(organization_id, numero, cliente_id, cliente_nombre, expediente,
                               token_publico, token_expira_at, estado_cliente, estado_proforma, total_mxn)
  VALUES
    (v_org, 'PF-FIX3-5', v_cli, 'Cliente FIX3 OBT', 'ELRPC00005', v_tk_expira, now() - interval '1 day', 'pendiente', 'pendiente', 12345);

  -- 4a. Token inválido.
  v_res := public.portal_obtener_proforma_por_token(v_tk_activo);
  PERFORM pg_temp.assert(v_res->>'error' = 'token_invalido', 'obtener: token inválido no devolvió token_invalido');

  -- 4b. Link expirado (BL-11): sólo id/numero, sin montos ni cliente.
  v_res := public.portal_obtener_proforma_por_token(v_tk_expira);
  PERFORM pg_temp.assert(v_res->>'estado_link' = 'expirado', 'obtener: link expirado no devolvió estado expirado');
  PERFORM pg_temp.assert(NOT (v_res->'proforma' ? 'total') AND NOT (v_res->'proforma' ? 'cliente_nombre'),
    'obtener: BL-11 roto — link expirado expone montos/cliente');

  -- 4c. Rate limit restaurado: 30/min. Ya consumimos 2; 28 más pasan y la
  -- 31ª debe caer. (El rate limit corre ANTES del lookup del token, así que
  -- el token inválido sirve para medir el bucket.)
  FOR i IN 1..28 LOOP
    PERFORM public.portal_obtener_proforma_por_token(v_tk_activo);
  END LOOP;
  BEGIN
    PERFORM public.portal_obtener_proforma_por_token(v_tk_activo);
  EXCEPTION WHEN raise_exception THEN
    v_limited := true;
  END;
  PERFORM pg_temp.assert(v_limited, 'obtener: la 31ª lectura en el minuto NO cayó por rate limit (drift BL-11)');

  RAISE NOTICE 'FIX3 obtener OK — BL-11 intacto y rate limit 30/min restaurado';
END $$;

ROLLBACK;
