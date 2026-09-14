-- =============================================================
-- B1 · v13.823.394 — Visibilidad operativa (SÓLO LECTURA) de la conciliación
-- de costos dentro del expediente del embarque.
--
-- Hallazgo: `coordinador_logistico` / `gerente_operaciones` veían la
-- conciliación en 0 / "Sin factura". Causa exacta:
--   · `conceptos_costo`  → policy "Tenant read conceptos_costo" YA los incluye
--     (has_any_role(uid,'viewer') expande la jerarquía y contiene ambos roles).
--   · `proveedor_facturas` → policy "Tenant read proveedor_facturas" YA los
--     incluye por la misma jerarquía, así que el embed del expediente funciona.
--     NO se crea una policy nueva para esa tabla: sería redundante y ampliaría
--     superficie sin necesidad.
--   · `proveedor_facturas_conceptos` → la ÚNICA policy permisiva es
--     "Tenant CRUD proveedor_facturas_conceptos", restringida a finanzas
--     (admin/contador/auxiliar_contable/tesorero). Ahí se corta la lectura.
--
-- Corrección mínima: una policy SELECT adicional, acotada a las filas cuyo
-- concepto de costo pertenece a un embarque VIVO de la organización ACTIVA.
-- No se toca la policy de finanzas, no se conceden INSERT/UPDATE/DELETE y no se
-- abre ningún listado general de CxP (las filas sin `concepto_costo_id`, usadas
-- sólo por el conteo de partidas huérfanas de finanzas, quedan ocultas a
-- propósito).
--
-- Los GRANT de tabla ya existen (SELECT a authenticated); no se modifican.
-- La policy RESTRICTIVA "Scope tenant activo super admin" sigue aplicando.
-- =============================================================

DROP POLICY IF EXISTS "Lectura operativa expediente proveedor_facturas_conceptos"
  ON public.proveedor_facturas_conceptos;

CREATE POLICY "Lectura operativa expediente proveedor_facturas_conceptos"
ON public.proveedor_facturas_conceptos
FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  AND (
    SELECT public.has_any_role_efectivo(
      (SELECT auth.uid()),
      ARRAY['coordinador_logistico', 'gerente_operaciones']::public.app_role[]
    )
  )
  AND EXISTS (
    SELECT 1
      FROM public.conceptos_costo cc
      JOIN public.embarques e ON e.id = cc.embarque_id
     WHERE cc.id = proveedor_facturas_conceptos.concepto_costo_id
       AND cc.organization_id = proveedor_facturas_conceptos.organization_id
       AND e.organization_id = proveedor_facturas_conceptos.organization_id
       AND e.deleted_at IS NULL
  )
);

COMMENT ON POLICY "Lectura operativa expediente proveedor_facturas_conceptos"
  ON public.proveedor_facturas_conceptos IS
  'B1 · v13.823.394 — Sólo SELECT, sólo para coordinador_logistico y gerente_operaciones, sólo vínculos de conceptos de costo de un embarque vivo de la organización activa. Sin captura, aprobación ni pago; no abre listados de CxP.';