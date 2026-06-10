
-- Fase 2 Costeo: condiciones de naviera + carta garantía + tabulador demoras
-- + vínculo obligatorio proveedor en costeo_agentes.

-- 1.1 NOT NULL en proveedor_id (sin filas previas)
ALTER TABLE public.costeo_agentes
  ALTER COLUMN proveedor_id SET NOT NULL;

-- 1.2 Tabla costeo_navieras_condiciones
CREATE TABLE public.costeo_navieras_condiciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  naviera_id uuid NOT NULL REFERENCES public.navieras(id) ON DELETE RESTRICT,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  tiene_carta_garantia boolean NOT NULL DEFAULT false,
  carta_garantia_vigente_hasta date,
  carta_garantia_folio text,
  carta_garantia_notas text,
  dias_libres_demoras_default integer NOT NULL DEFAULT 0 CHECK (dias_libres_demoras_default >= 0),
  moneda_demoras text NOT NULL DEFAULT 'USD',
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, naviera_id),
  CONSTRAINT carta_garantia_requires_fecha
    CHECK (tiene_carta_garantia = false OR carta_garantia_vigente_hasta IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_navieras_condiciones TO authenticated;
GRANT ALL ON public.costeo_navieras_condiciones TO service_role;

ALTER TABLE public.costeo_navieras_condiciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costeo_nav_cond_select_org"
  ON public.costeo_navieras_condiciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_navieras_condiciones.organization_id
      AND m.user_id = auth.uid()));

CREATE POLICY "costeo_nav_cond_write_org"
  ON public.costeo_navieras_condiciones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_navieras_condiciones.organization_id
      AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = costeo_navieras_condiciones.organization_id
      AND m.user_id = auth.uid()));

CREATE TRIGGER trg_costeo_nav_cond_updated
  BEFORE UPDATE ON public.costeo_navieras_condiciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 Tabla costeo_naviera_demoras_tarifa
CREATE TABLE public.costeo_naviera_demoras_tarifa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naviera_condicion_id uuid NOT NULL REFERENCES public.costeo_navieras_condiciones(id) ON DELETE CASCADE,
  tipo_contenedor_id uuid NOT NULL REFERENCES public.tipos_contenedor(id),
  desde_dia integer NOT NULL CHECK (desde_dia >= 1),
  hasta_dia integer CHECK (hasta_dia IS NULL OR hasta_dia >= desde_dia),
  monto_por_dia numeric(12,2) NOT NULL CHECK (monto_por_dia >= 0),
  moneda text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (naviera_condicion_id, tipo_contenedor_id, desde_dia)
);

CREATE INDEX idx_demoras_tarifa_lookup
  ON public.costeo_naviera_demoras_tarifa(naviera_condicion_id, tipo_contenedor_id, desde_dia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.costeo_naviera_demoras_tarifa TO authenticated;
GRANT ALL ON public.costeo_naviera_demoras_tarifa TO service_role;

ALTER TABLE public.costeo_naviera_demoras_tarifa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "costeo_demoras_select_org"
  ON public.costeo_naviera_demoras_tarifa FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.costeo_navieras_condiciones c
    JOIN public.organization_members m
      ON m.organization_id = c.organization_id
    WHERE c.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
      AND m.user_id = auth.uid()
  ));

CREATE POLICY "costeo_demoras_write_org"
  ON public.costeo_naviera_demoras_tarifa FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.costeo_navieras_condiciones c
    JOIN public.organization_members m
      ON m.organization_id = c.organization_id
    WHERE c.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
      AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.costeo_navieras_condiciones c
    JOIN public.organization_members m
      ON m.organization_id = c.organization_id
    WHERE c.id = costeo_naviera_demoras_tarifa.naviera_condicion_id
      AND m.user_id = auth.uid()
  ));

CREATE TRIGGER trg_costeo_demoras_updated
  BEFORE UPDATE ON public.costeo_naviera_demoras_tarifa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.5 Función calcular_costo_demoras
CREATE OR REPLACE FUNCTION public.calcular_costo_demoras(
  p_naviera_condicion_id uuid,
  p_tipo_contenedor_id uuid,
  p_dias_excedidos integer
) RETURNS TABLE (total numeric, moneda text, desglose jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_total numeric := 0;
  v_moneda text := 'USD';
  v_desglose jsonb := '[]'::jsonb;
  v_dias_en_tramo integer;
  v_top integer;
BEGIN
  IF p_dias_excedidos IS NULL OR p_dias_excedidos < 1 THEN
    RETURN QUERY SELECT 0::numeric, v_moneda, v_desglose;
    RETURN;
  END IF;

  FOR r IN
    SELECT desde_dia, hasta_dia, monto_por_dia, moneda
    FROM public.costeo_naviera_demoras_tarifa
    WHERE naviera_condicion_id = p_naviera_condicion_id
      AND tipo_contenedor_id = p_tipo_contenedor_id
      AND desde_dia <= p_dias_excedidos
    ORDER BY desde_dia
  LOOP
    v_top := LEAST(COALESCE(r.hasta_dia, p_dias_excedidos), p_dias_excedidos);
    v_dias_en_tramo := v_top - r.desde_dia + 1;
    IF v_dias_en_tramo > 0 THEN
      v_total := v_total + (v_dias_en_tramo * r.monto_por_dia);
      v_moneda := r.moneda;
      v_desglose := v_desglose || jsonb_build_object(
        'desde_dia', r.desde_dia,
        'hasta_dia', v_top,
        'dias', v_dias_en_tramo,
        'monto_por_dia', r.monto_por_dia,
        'subtotal', v_dias_en_tramo * r.monto_por_dia,
        'moneda', r.moneda
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_moneda, v_desglose;
END;
$$;

REVOKE ALL ON FUNCTION public.calcular_costo_demoras(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calcular_costo_demoras(uuid, uuid, integer) TO authenticated, service_role;

-- 1.6 Extender vista costeo_tarifas_vigentes_v con info de naviera
CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v AS
SELECT t.id,
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
       COALESCE((SELECT sum(rc.monto)
                 FROM public.costeo_tarifa_recargos rc
                 WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS recargos_total,
       t.flete_base + COALESCE((SELECT sum(rc.monto)
                 FROM public.costeo_tarifa_recargos rc
                 WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS total_comparable,
       t.dias_libres_demoras,
       t.transit_time_dias,
       t.vigente_desde,
       t.vigente_hasta,
       t.estado,
       -- Info de naviera (LEFT JOIN — puede no existir aún)
       nc.id AS naviera_condicion_id,
       COALESCE(nc.tiene_carta_garantia, false) AS naviera_tiene_carta_garantia,
       nc.carta_garantia_vigente_hasta AS naviera_carta_garantia_vigente_hasta,
       (nc.tiene_carta_garantia = true
        AND nc.carta_garantia_vigente_hasta IS NOT NULL
        AND nc.carta_garantia_vigente_hasta >= CURRENT_DATE) AS naviera_carta_garantia_activa,
       nc.dias_libres_demoras_default AS naviera_dias_libres_default,
       (SELECT dt.monto_por_dia
          FROM public.costeo_naviera_demoras_tarifa dt
          WHERE dt.naviera_condicion_id = nc.id
            AND dt.tipo_contenedor_id = t.tipo_contenedor_id
            AND dt.desde_dia <= 6
            AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6)
          LIMIT 1) AS naviera_demora_dia_6
  FROM public.costeo_tarifas t
  JOIN public.costeo_agentes a ON a.id = t.agente_id
  JOIN public.navieras n ON n.id = t.naviera_id
  JOIN public.costeo_rutas r ON r.id = t.ruta_id
  JOIN public.puertos po ON po.id = r.puerto_origen_id
  JOIN public.puertos pd ON pd.id = r.puerto_destino_id
  JOIN public.tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
  LEFT JOIN public.costeo_navieras_condiciones nc
         ON nc.naviera_id = t.naviera_id
        AND nc.organization_id = t.organization_id;
