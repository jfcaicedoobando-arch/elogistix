ALTER TABLE public.embarque_garantias_contenedor
  ADD COLUMN IF NOT EXISTS referencia_deposito text,
  ADD COLUMN IF NOT EXISTS fecha_limite_devolucion date;

CREATE OR REPLACE FUNCTION public.calc_fecha_limite_devolucion_garantia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias int;
  v_org_id uuid;
BEGIN
  IF NEW.fecha_deposito IS NULL OR NEW.naviera_id IS NULL THEN
    NEW.fecha_limite_devolucion := NULL;
    RETURN NEW;
  END IF;

  SELECT e.organization_id INTO v_org_id
  FROM embarques e WHERE e.id = NEW.embarque_id;

  SELECT nc.dias_libres_demoras_default INTO v_dias
  FROM costeo_navieras_condiciones nc
  WHERE nc.naviera_id = NEW.naviera_id
    AND nc.organization_id = v_org_id
  LIMIT 1;

  IF v_dias IS NULL THEN
    NEW.fecha_limite_devolucion := NULL;
  ELSE
    NEW.fecha_limite_devolucion := NEW.fecha_deposito + (v_dias || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_fecha_limite_devolucion ON public.embarque_garantias_contenedor;
CREATE TRIGGER trg_calc_fecha_limite_devolucion
  BEFORE INSERT OR UPDATE OF fecha_deposito, naviera_id
  ON public.embarque_garantias_contenedor
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_fecha_limite_devolucion_garantia();

UPDATE public.embarque_garantias_contenedor g
SET fecha_limite_devolucion = g.fecha_deposito + (nc.dias_libres_demoras_default || ' days')::interval
FROM public.embarques e,
     public.costeo_navieras_condiciones nc
WHERE g.embarque_id = e.id
  AND nc.naviera_id = g.naviera_id
  AND nc.organization_id = e.organization_id
  AND g.fecha_deposito IS NOT NULL;

DROP FUNCTION IF EXISTS public.sidebar_alert_counts();

CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint, garantias_atoradas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Cerrado') THEN e.estado::text
         WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
              AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
           CASE
             WHEN current_date < e.etd THEN 'Confirmado'
             WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
             WHEN current_date >= e.eta THEN 'Arribo'
             ELSE e.estado::text
           END
         ELSE e.estado::text
       END = 'Arribo'
       AND (e.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND (f.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS facturas_vencidas,
    (SELECT count(*) FROM embarque_garantias_contenedor g
     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'
       AND g.fecha_deposito IS NOT NULL
       AND (current_date - g.fecha_deposito) > 30
       AND (e.organization_id = current_user_org_id()
            OR has_role(auth.uid(), 'super_admin'))
    ) AS garantias_atoradas;
$$;