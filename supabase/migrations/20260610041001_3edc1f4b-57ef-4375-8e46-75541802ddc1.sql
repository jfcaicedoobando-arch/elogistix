
-- Add reemplazada_por to track tariff replacement chain
ALTER TABLE public.costeo_tarifas
  ADD COLUMN IF NOT EXISTS reemplazada_por uuid REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_costeo_tarifas_reemplazada_por ON public.costeo_tarifas(reemplazada_por);

-- Trigger: when a new tarifa is inserted for the same (org, agente, ruta, tipo_contenedor),
-- mark the prior vigente tarifas as 'reemplazada' and link reemplazada_por.
CREATE OR REPLACE FUNCTION public.costeo_tarifas_marcar_reemplazadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.costeo_tarifas
     SET estado = 'reemplazada',
         reemplazada_por = NEW.id,
         updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND agente_id = NEW.agente_id
     AND ruta_id = NEW.ruta_id
     AND tipo_contenedor_id = NEW.tipo_contenedor_id
     AND id <> NEW.id
     AND estado = 'vigente'
     AND reemplazada_por IS NULL
     AND vigente_desde <= NEW.vigente_desde;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_tarifas_marcar_reemplazadas ON public.costeo_tarifas;
CREATE TRIGGER trg_costeo_tarifas_marcar_reemplazadas
AFTER INSERT ON public.costeo_tarifas
FOR EACH ROW EXECUTE FUNCTION public.costeo_tarifas_marcar_reemplazadas();

-- Trazabilidad en cotizacion_costos hacia la tarifa de Costeo elegida
ALTER TABLE public.cotizacion_costos
  ADD COLUMN IF NOT EXISTS costeo_tarifa_id uuid REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS costeo_tarifa_recargo_id uuid REFERENCES public.costeo_tarifa_recargos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizacion_costos_costeo_tarifa ON public.cotizacion_costos(costeo_tarifa_id);

-- RPC: Top 3 tarifas vigentes para una ruta + tipo de contenedor en una fecha dada.
-- Orden: total_comparable ASC, dias_credito DESC, dias_libres_demoras DESC.
CREATE OR REPLACE FUNCTION public.get_top_tarifas(
  p_puerto_origen_id uuid,
  p_puerto_destino_id uuid,
  p_tipo_contenedor_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_organization_id uuid DEFAULT NULL
)
RETURNS SETOF public.costeo_tarifas_vigentes_v
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.*
    FROM public.costeo_tarifas_vigentes_v v
   WHERE v.puerto_origen_id  = p_puerto_origen_id
     AND v.puerto_destino_id = p_puerto_destino_id
     AND v.tipo_contenedor_id = p_tipo_contenedor_id
     AND v.estado = 'vigente'
     AND v.vigente_desde <= p_fecha
     AND v.vigente_hasta >= p_fecha
     AND (
       p_organization_id IS NOT NULL AND v.organization_id = p_organization_id
       OR p_organization_id IS NULL AND EXISTS (
         SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = v.organization_id
            AND om.user_id = auth.uid()
       )
     )
   ORDER BY v.total_comparable ASC,
            v.dias_credito DESC NULLS LAST,
            v.dias_libres_demoras DESC NULLS LAST
   LIMIT 3;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) TO service_role;
