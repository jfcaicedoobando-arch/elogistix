-- ============================================================================
-- fix3 (tanda 3) — RLS del portal: eventos/notas internos ya no son legibles
-- por cliente ni agente de carga vía API directa.
--
-- Cubre la migración 20260831200100_fix3_portal_rls_eventos_notas.sql:
--   1. Cliente sólo ve hitos de negocio en eventos_embarque (misma lista que
--      get_tracking_public / RUX-01) y nada con marcas [interno]/harness/e2e/
--      seed/qa- ni borrados lógicos.
--   2. Cliente sólo ve notas tipo 'cambio_estado' limpias (la nota operativa
--      de texto libre del staff ya no se expone).
--   3. Agente de carga: mismo criterio sobre notas de SUS embarques.
--   4. Aislamiento base intacto: el cliente no ve eventos de otro cliente.
--   5. Control: staff (operador) sigue viendo todo.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_portal_rls_eventos_notas.sql
-- Todo el fixture vive dentro de BEGIN…ROLLBACK: no ensucia el snapshot.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a   uuid := gen_random_uuid();
  org_b   uuid := gen_random_uuid();
  cli_a   uuid := gen_random_uuid();
  cli_b   uuid := gen_random_uuid();
  cli_bb  uuid := gen_random_uuid();  -- cliente de org_b (embarque del agente)
  u_cli   uuid := gen_random_uuid();  -- usuario portal cliente (cliente A)
  u_ope   uuid := gen_random_uuid();  -- staff operador org A (control)
  u_agt   uuid := gen_random_uuid();  -- usuario portal agente (org B)
  prov_b  uuid := gen_random_uuid();
  agt_b   uuid := gen_random_uuid();
  emb_a   uuid := gen_random_uuid();  -- embarque del cliente A
  emb_b   uuid := gen_random_uuid();  -- embarque del cliente B (mismo org A)
  emb_ag  uuid := gen_random_uuid();  -- embarque del agente (org B)
  n int;
BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'FIX3 Org A'), (org_b, 'FIX3 Org B');

  INSERT INTO public.clientes(id, organization_id, nombre, rfc, email) VALUES
    (cli_a, org_a, 'Cliente FIX3 A', 'XAXX010101E10', 'fix3a@test.local'),
    (cli_b, org_a, 'Cliente FIX3 B', 'XAXX010101E11', 'fix3b@test.local'),
    -- v13.782.1 — el embarque del agente vive en org_b; su cliente debe ser de
    -- la MISMA org (trigger `_assert_padre_misma_org` de la Ola E1).
    (cli_bb, org_b, 'Cliente FIX3 B-org', 'XAXX010101E12', 'fix3bb@test.local');

  -- Los FK de user_roles/client_users apuntan a auth.users: se siembran los
  -- tres usuarios de prueba (mismo patrón que aging_nc_deleted_at.sql).
  INSERT INTO auth.users (id, email) VALUES
    (u_cli, 'fix3-cli@test.local'),
    (u_ope, 'fix3-ope@test.local'),
    (u_agt, 'fix3-agt@test.local')
  ON CONFLICT (id) DO NOTHING;

  -- Nota: los roles legacy (admin/operador/viewer) están bloqueados por
  -- trigger; coordinador_logistico hereda 'operador' vía roles_jerarquia.
  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_cli, 'cliente'),
    (u_ope, 'coordinador_logistico'),
    (u_agt, 'agente_carga');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_ope, 'coordinador_logistico');

  INSERT INTO public.client_users(user_id, cliente_id, organization_id) VALUES
    (u_cli, cli_a, org_a);

  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, estado, modo, tipo) VALUES
    (emb_a, org_a, cli_a, 'ELAAA00001', 'Confirmado', 'Marítimo', 'Importación'),
    (emb_b, org_a, cli_b, 'ELBBB00001', 'Confirmado', 'Marítimo', 'Importación');

  -- Eventos del embarque del cliente A: 1 hito limpio + ruido que NO debe verse.
  INSERT INTO public.eventos_embarque(id, organization_id, embarque_id, tipo, descripcion, usuario, deleted_at) VALUES
    (gen_random_uuid(), org_a, emb_a, 'Zarpe',  'Zarpe confirmado', 'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'Otro',   'Nota operativa interna', 'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'Zarpe',  'Rezagó el cliente [interno]', 'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'Entrega','Entrega simulada', 'qa-bot', NULL),
    (gen_random_uuid(), org_a, emb_a, 'Arribo a Puerto', 'Arribo (borrado)', 'ops@elogistix.mx', now());
  -- Evento del embarque de OTRO cliente (aislamiento).
  INSERT INTO public.eventos_embarque(id, organization_id, embarque_id, tipo, descripcion, usuario) VALUES
    (gen_random_uuid(), org_a, emb_b, 'Zarpe', 'Zarpe del cliente B', 'ops@elogistix.mx');

  -- Notas del embarque del cliente A: 1 cambio_estado limpio + lo demás oculto.
  INSERT INTO public.notas_embarque(id, organization_id, embarque_id, tipo, contenido, usuario, deleted_at) VALUES
    (gen_random_uuid(), org_a, emb_a, 'cambio_estado', 'Estado: Borrador → Confirmado', 'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'nota',          'El cliente regateó el flete',   'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'cambio_estado', 'Ajuste manual [interno]',       'ops@elogistix.mx', NULL),
    (gen_random_uuid(), org_a, emb_a, 'cambio_estado', 'Cambio borrado',                'ops@elogistix.mx', now());

  -- Agente de carga (org B) con su embarque y notas.
  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_b, 'Proveedor FIX3 B', org_b, 'Agente Aduanal', 'Logistico');
  INSERT INTO public.costeo_agentes(id, organization_id, proveedor_id, nombre, pais, dias_credito) VALUES
    (agt_b, org_b, prov_b, 'Agente FIX3', 'MX', 0);
  INSERT INTO public.agente_users(user_id, agente_id, organization_id) VALUES
    (u_agt, agt_b, org_b);
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, estado, modo, tipo, agente_id) VALUES
    (emb_ag, org_b, cli_bb, 'ELGGG00001', 'Confirmado', 'Marítimo', 'Importación', agt_b);
  INSERT INTO public.notas_embarque(id, organization_id, embarque_id, tipo, contenido, usuario) VALUES
    (gen_random_uuid(), org_b, emb_ag, 'cambio_estado', 'Estado: Borrador → Confirmado', 'ops@elogistix.mx'),
    (gen_random_uuid(), org_b, emb_ag, 'nota',          'Comentario interno del staff',  'ops@elogistix.mx'),
    (gen_random_uuid(), org_b, emb_ag, 'cambio_estado', 'Cambio seed e2e',               'ops@elogistix.mx');

  -- ── 1. Cliente: sólo hitos limpios en eventos ────────────────────────────
  PERFORM pg_temp.as_user(u_cli);
  SELECT count(*) INTO n FROM public.eventos_embarque WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 1,
    'cliente debe ver exactamente 1 evento (el hito limpio); vio ' || n || ' (tipos internos/marcas/borrados expuestos)');
  SELECT count(*) INTO n FROM public.eventos_embarque
   WHERE embarque_id = emb_a AND (tipo::text = 'Otro' OR descripcion ILIKE '%[interno]%' OR usuario ILIKE '%qa-%' OR deleted_at IS NOT NULL);
  PERFORM pg_temp.assert(n = 0, 'cliente NO debe ver eventos internos/marcados/borrados');

  -- ── 2. Cliente: sólo cambio_estado limpio en notas ───────────────────────
  SELECT count(*) INTO n FROM public.notas_embarque WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 1,
    'cliente debe ver exactamente 1 nota (cambio_estado limpio); vio ' || n || ' (notas de staff expuestas)');
  SELECT count(*) INTO n FROM public.notas_embarque
   WHERE embarque_id = emb_a AND (tipo = 'nota'::tipo_nota OR contenido ILIKE '%[interno]%' OR deleted_at IS NOT NULL);
  PERFORM pg_temp.assert(n = 0, 'cliente NO debe ver notas operativas/marcadas/borradas');

  -- ── 3. Agente: mismo criterio sobre notas de su embarque ─────────────────
  PERFORM pg_temp.as_user(u_agt);
  SELECT count(*) INTO n FROM public.notas_embarque WHERE embarque_id = emb_ag;
  PERFORM pg_temp.assert(n = 1,
    'agente debe ver exactamente 1 nota (cambio_estado limpio); vio ' || n);
  SELECT count(*) INTO n FROM public.notas_embarque
   WHERE embarque_id = emb_ag AND (tipo = 'nota'::tipo_nota OR contenido ILIKE '%seed%');
  PERFORM pg_temp.assert(n = 0, 'agente NO debe ver notas operativas ni marcadas');

  -- ── 4. Aislamiento base intacto ──────────────────────────────────────────
  PERFORM pg_temp.as_user(u_cli);
  SELECT count(*) INTO n FROM public.eventos_embarque WHERE embarque_id = emb_b;
  PERFORM pg_temp.assert(n = 0, 'cliente NO debe ver eventos de embarques ajenos');

  -- ── 5. Control: staff operador sigue viendo todo ─────────────────────────
  PERFORM pg_temp.as_user(u_ope);
  SELECT count(*) INTO n FROM public.eventos_embarque WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 5, 'operador debe seguir viendo los 5 eventos; vio ' || n);
  SELECT count(*) INTO n FROM public.notas_embarque WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 4, 'operador debe seguir viendo las 4 notas; vio ' || n);

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'FIX3 RLS portal OK — eventos/notas internos invisibles para cliente y agente; staff intacto';
END $$;

ROLLBACK;
