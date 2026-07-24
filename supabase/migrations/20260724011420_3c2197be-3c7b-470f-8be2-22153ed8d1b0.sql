-- Fix: agente_carga role cannot read child tables of embarques it can see.
-- Adds SELECT policies mirroring "Agente read own embarques" for documentos,
-- notas, conceptos_venta, conceptos_costo and facturas.

DROP POLICY IF EXISTS "Agente read own documentos" ON public.documentos_embarque;
CREATE POLICY "Agente read own documentos"
  ON public.documentos_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      JOIN public.costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = documentos_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente IS NOT NULL
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );

DROP POLICY IF EXISTS "Agente read own notas" ON public.notas_embarque;
CREATE POLICY "Agente read own notas"
  ON public.notas_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND tipo = ANY (ARRAY['nota'::tipo_nota, 'cambio_estado'::tipo_nota])
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      JOIN public.costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = notas_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente IS NOT NULL
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );

DROP POLICY IF EXISTS "Agente read own conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Agente read own conceptos_venta"
  ON public.conceptos_venta FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      JOIN public.costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = conceptos_venta.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente IS NOT NULL
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );

DROP POLICY IF EXISTS "Agente read own conceptos_costo" ON public.conceptos_costo;
CREATE POLICY "Agente read own conceptos_costo"
  ON public.conceptos_costo FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      JOIN public.costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = conceptos_costo.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente IS NOT NULL
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );

DROP POLICY IF EXISTS "Agente read own facturas" ON public.facturas;
CREATE POLICY "Agente read own facturas"
  ON public.facturas FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND embarque_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      JOIN public.costeo_agentes a ON a.id = current_agente_id()
      WHERE e.id = facturas.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente IS NOT NULL
        AND lower(trim(e.agente)) = lower(trim(a.nombre))
    )
  );