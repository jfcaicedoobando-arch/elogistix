
-- Módulo Costeo v1 — Tarifas marítimas China → México

-- 1) Agentes
CREATE TABLE public.costeo_agentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  proveedor_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  pais text NOT NULL DEFAULT 'CN',
  dias_credito integer NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
  contacto_tarifario text,
  email text,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, nombre)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_agentes TO authenticated;
GRANT ALL ON public.costeo_agentes TO service_role;
ALTER TABLE public.costeo_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costeo_agentes_select_org" ON public.costeo_agentes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_agentes.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "costeo_agentes_write_org" ON public.costeo_agentes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_agentes.organization_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_agentes.organization_id AND m.user_id = auth.uid()));

-- 2) Rutas
CREATE TABLE public.costeo_rutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  puerto_origen_id uuid NOT NULL REFERENCES public.puertos(id),
  puerto_destino_id uuid NOT NULL REFERENCES public.puertos(id),
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, puerto_origen_id, puerto_destino_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_rutas TO authenticated;
GRANT ALL ON public.costeo_rutas TO service_role;
ALTER TABLE public.costeo_rutas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costeo_rutas_select_org" ON public.costeo_rutas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_rutas.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "costeo_rutas_write_org" ON public.costeo_rutas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_rutas.organization_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_rutas.organization_id AND m.user_id = auth.uid()));

-- 3) Tarifas
CREATE TABLE public.costeo_tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  agente_id uuid NOT NULL REFERENCES public.costeo_agentes(id) ON DELETE RESTRICT,
  naviera_id uuid NOT NULL REFERENCES public.navieras(id),
  ruta_id uuid NOT NULL REFERENCES public.costeo_rutas(id),
  tipo_contenedor_id uuid NOT NULL REFERENCES public.tipos_contenedor(id),
  moneda text NOT NULL DEFAULT 'USD',
  flete_base numeric(12,2) NOT NULL CHECK (flete_base >= 0),
  dias_libres_demoras integer NOT NULL DEFAULT 0 CHECK (dias_libres_demoras >= 0),
  vigente_desde date NOT NULL,
  vigente_hasta date NOT NULL,
  transit_time_dias integer,
  notas text,
  estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('borrador','vigente','vencida')),
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigente_hasta >= vigente_desde),
  UNIQUE (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, vigente_desde)
);
CREATE INDEX idx_costeo_tarifas_lookup ON public.costeo_tarifas (organization_id, ruta_id, tipo_contenedor_id, vigente_desde, vigente_hasta);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_tarifas TO authenticated;
GRANT ALL ON public.costeo_tarifas TO service_role;
ALTER TABLE public.costeo_tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costeo_tarifas_select_org" ON public.costeo_tarifas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_tarifas.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "costeo_tarifas_write_org" ON public.costeo_tarifas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_tarifas.organization_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id = costeo_tarifas.organization_id AND m.user_id = auth.uid()));

-- 4) Recargos
CREATE TABLE public.costeo_tarifa_recargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarifa_id uuid NOT NULL REFERENCES public.costeo_tarifas(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  lado text NOT NULL CHECK (lado IN ('origen','destino')),
  monto numeric(12,2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  moneda text NOT NULL DEFAULT 'USD',
  incluido_en_total boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_costeo_tarifa_recargos_tarifa ON public.costeo_tarifa_recargos (tarifa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_tarifa_recargos TO authenticated;
GRANT ALL ON public.costeo_tarifa_recargos TO service_role;
ALTER TABLE public.costeo_tarifa_recargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costeo_recargos_select_org" ON public.costeo_tarifa_recargos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.costeo_tarifas t JOIN public.organization_members m ON m.organization_id = t.organization_id WHERE t.id = costeo_tarifa_recargos.tarifa_id AND m.user_id = auth.uid()));
CREATE POLICY "costeo_recargos_write_org" ON public.costeo_tarifa_recargos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.costeo_tarifas t JOIN public.organization_members m ON m.organization_id = t.organization_id WHERE t.id = costeo_tarifa_recargos.tarifa_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.costeo_tarifas t JOIN public.organization_members m ON m.organization_id = t.organization_id WHERE t.id = costeo_tarifa_recargos.tarifa_id AND m.user_id = auth.uid()));

CREATE TRIGGER trg_costeo_agentes_updated BEFORE UPDATE ON public.costeo_agentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_costeo_rutas_updated BEFORE UPDATE ON public.costeo_rutas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_costeo_tarifas_updated BEFORE UPDATE ON public.costeo_tarifas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vista con total comparable
CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v AS
SELECT
  t.id,
  t.organization_id,
  t.agente_id,
  a.nombre AS agente_nombre,
  a.dias_credito,
  t.naviera_id,
  n.name AS naviera_nombre,
  t.ruta_id,
  r.puerto_origen_id,
  r.puerto_destino_id,
  po.name AS puerto_origen_nombre,
  pd.name AS puerto_destino_nombre,
  t.tipo_contenedor_id,
  tc.name AS tipo_contenedor_nombre,
  t.moneda,
  t.flete_base,
  COALESCE((SELECT SUM(rc.monto) FROM public.costeo_tarifa_recargos rc WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0) AS recargos_total,
  t.flete_base + COALESCE((SELECT SUM(rc.monto) FROM public.costeo_tarifa_recargos rc WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0) AS total_comparable,
  t.dias_libres_demoras,
  t.transit_time_dias,
  t.vigente_desde,
  t.vigente_hasta,
  t.estado
FROM public.costeo_tarifas t
JOIN public.costeo_agentes a ON a.id = t.agente_id
JOIN public.navieras n ON n.id = t.naviera_id
JOIN public.costeo_rutas r ON r.id = t.ruta_id
JOIN public.puertos po ON po.id = r.puerto_origen_id
JOIN public.puertos pd ON pd.id = r.puerto_destino_id
JOIN public.tipos_contenedor tc ON tc.id = t.tipo_contenedor_id;

GRANT SELECT ON public.costeo_tarifas_vigentes_v TO authenticated;
GRANT SELECT ON public.costeo_tarifas_vigentes_v TO service_role;

-- RPC: Top N tarifas vigentes
CREATE OR REPLACE FUNCTION public.obtener_top_tarifas(
  p_ruta_id uuid,
  p_tipo_contenedor_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  tarifa_id uuid,
  agente_nombre text,
  naviera_nombre text,
  puerto_origen_nombre text,
  puerto_destino_nombre text,
  moneda text,
  flete_base numeric,
  recargos_total numeric,
  total_comparable numeric,
  dias_credito integer,
  dias_libres_demoras integer,
  transit_time_dias integer,
  vigente_hasta date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.id, v.agente_nombre, v.naviera_nombre, v.puerto_origen_nombre, v.puerto_destino_nombre,
         v.moneda, v.flete_base, v.recargos_total, v.total_comparable,
         v.dias_credito, v.dias_libres_demoras, v.transit_time_dias, v.vigente_hasta
  FROM public.costeo_tarifas_vigentes_v v
  WHERE v.ruta_id = p_ruta_id
    AND v.tipo_contenedor_id = p_tipo_contenedor_id
    AND v.estado = 'vigente'
    AND p_fecha BETWEEN v.vigente_desde AND v.vigente_hasta
  ORDER BY v.total_comparable ASC, v.dias_credito DESC, v.dias_libres_demoras DESC, v.vigente_hasta DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_top_tarifas(uuid, uuid, date, integer) TO authenticated;
