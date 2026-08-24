-- ============================================================================
-- fix3 (tanda 3, superficie pública) — RLS de eventos/notas del portal.
--
-- Hallazgo (bugs2/public_surface_hunter.md, P2): las policies
--   "Cliente read own eventos"  — sin filtro de tipo ni marcas,
--   "Cliente read own notas"    — tipo IN ('nota','cambio_estado'),
--   "Agente read own notas"     — idem,
-- exponen por API directa (PostgREST con el JWT del cliente/agente) eventos
-- internos/semilla/E2E y notas operativas de texto libre del staff. El fix
-- RUX-01 (20260813022635) sólo se aplicó al RPC público get_tracking_public;
-- la UI del portal filtra en cliente, la API no.
--
-- Fix: se replica en las policies el mismo predicado del RPC público:
--   · eventos: sólo hitos de negocio (misma lista que get_tracking_public y
--     src/lib/domain/eventosVisiblesCliente.ts) y sin marcas internas
--     ([interno], harness, e2e, seed, qa-) en descripcion/usuario; además se
--     ocultan los borrados lógicos (deleted_at), como ya hace la UI.
--   · notas: el equivalente a "hito de negocio" es 'cambio_estado'; la nota
--     operativa de texto libre ('nota') deja de ser legible para cliente y
--     agente (el portal nunca la consulta — sólo la usa staff, que entra por
--     las policies "Tenant CRUD notas_embarque"/"Tenant viewer…"). Mismas
--     marcas internas y deleted_at.
--
-- Test: supabase/tests/fix3_portal_rls_eventos_notas.sql (cableado en
-- .github/workflows/rls-tests.yml).
-- ============================================================================

-- ── Cliente: eventos sólo hitos visibles ─────────────────────────────────────
DROP POLICY IF EXISTS "Cliente read own eventos" ON public.eventos_embarque;
CREATE POLICY "Cliente read own eventos" ON public.eventos_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
  -- Mismo predicado que get_tracking_public (RUX-01): sólo hitos de negocio
  -- y sin marcas internas/semilla/E2E.
  AND tipo::text IN (
    'Zarpe', 'Transbordo', 'Arribo a Puerto', 'Descarga',
    'Despacho Aduanal', 'Liberación', 'En Ruta Terrestre', 'Entrega',
    'Cambio de ETA'
  )
  AND deleted_at IS NULL
  AND lower(COALESCE(descripcion, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
  AND lower(COALESCE(usuario, ''))     NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
);

-- ── Cliente: notas sólo cambios de estado, sin marcas internas ───────────────
DROP POLICY IF EXISTS "Cliente read own notas" ON public.notas_embarque;
CREATE POLICY "Cliente read own notas" ON public.notas_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  tipo = 'cambio_estado'::tipo_nota AND
  deleted_at IS NULL AND
  lower(COALESCE(contenido, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%']) AND
  lower(COALESCE(usuario, ''))   NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%']) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

-- ── Agente de carga: notas sólo cambios de estado, sin marcas internas ───────
DROP POLICY IF EXISTS "Agente read own notas" ON public.notas_embarque;
CREATE POLICY "Agente read own notas"
  ON public.notas_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND tipo = 'cambio_estado'::tipo_nota
    AND deleted_at IS NULL
    AND lower(COALESCE(contenido, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
    AND lower(COALESCE(usuario, ''))   NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.id = notas_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente_id IS NOT NULL
        AND e.agente_id = current_agente_id()
    )
  );
