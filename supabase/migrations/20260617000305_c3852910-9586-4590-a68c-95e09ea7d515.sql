-- 1) Frecuencia del servicio en la naviera (por org+naviera)
ALTER TABLE public.costeo_navieras_condiciones
  ADD COLUMN IF NOT EXISTS frecuencia text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costeo_nav_cond_frecuencia_chk') THEN
    ALTER TABLE public.costeo_navieras_condiciones
      ADD CONSTRAINT costeo_nav_cond_frecuencia_chk
      CHECK (frecuencia IS NULL OR frecuencia IN ('Diaria','Semanal','Quincenal','Mensual','Bajo demanda'));
  END IF;
END$$;

COMMENT ON COLUMN public.costeo_navieras_condiciones.frecuencia IS
  'Frecuencia del servicio de la naviera. Se hereda al wizard de cotización vía la vista costeo_tarifas_vigentes_v.';

-- 2) Override de frecuencia y días libres LCL en tarifa individual
ALTER TABLE public.costeo_tarifas
  ADD COLUMN IF NOT EXISTS frecuencia_override text,
  ADD COLUMN IF NOT EXISTS dias_libres_almacenaje_lcl integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costeo_tarifas_frecuencia_override_chk') THEN
    ALTER TABLE public.costeo_tarifas
      ADD CONSTRAINT costeo_tarifas_frecuencia_override_chk
      CHECK (frecuencia_override IS NULL OR frecuencia_override IN ('Diaria','Semanal','Quincenal','Mensual','Bajo demanda'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costeo_tarifas_dias_libres_almacenaje_lcl_chk') THEN
    ALTER TABLE public.costeo_tarifas
      ADD CONSTRAINT costeo_tarifas_dias_libres_almacenaje_lcl_chk
      CHECK (dias_libres_almacenaje_lcl IS NULL OR dias_libres_almacenaje_lcl >= 0);
  END IF;
END$$;

COMMENT ON COLUMN public.costeo_tarifas.frecuencia_override IS
  'Si se llena, sobreescribe la frecuencia heredada de costeo_navieras_condiciones para esta tarifa.';
COMMENT ON COLUMN public.costeo_tarifas.dias_libres_almacenaje_lcl IS
  'Días libres de almacenaje específicos para tarifas LCL. FCL sigue usando dias_libres_demoras.';

-- 3) Recrear la vista y la función RPC que depende de ella
DROP VIEW IF EXISTS public.costeo_tarifas_vigentes_v CASCADE;

CREATE VIEW public.costeo_tarifas_vigentes_v AS
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
          LIMIT 1) AS naviera_demora_dia_6,
       -- v13.47.0: heredables para el wizard de cotización
       t.dias_libres_almacenaje_lcl,
       COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
       nc.frecuencia AS naviera_frecuencia,
       t.frecuencia_override AS tarifa_frecuencia_override
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

GRANT SELECT ON public.costeo_tarifas_vigentes_v TO authenticated;
GRANT SELECT ON public.costeo_tarifas_vigentes_v TO service_role;

CREATE OR REPLACE FUNCTION public.get_top_tarifas(
  p_puerto_origen_id uuid,
  p_puerto_destino_id uuid,
  p_tipo_contenedor_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF costeo_tarifas_vigentes_v
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;
