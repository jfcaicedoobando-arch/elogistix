-- ============================================================
-- FIX B-066 · agente_aprobar_tarifa (usuario_id + drop overload)
-- ============================================================
DROP FUNCTION IF EXISTS public.agente_aprobar_tarifa(uuid, text);

CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa(
  _tarifa_id uuid, _estado text, _motivo text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_agente_id uuid;
  v_ruta_id uuid;
  v_agente_user uuid;
  v_ruta_txt text;
BEGIN
  IF _estado NOT IN ('vigente','rechazada','borrador') THEN
    RAISE EXCEPTION 'estado inválido: %', _estado;
  END IF;

  SELECT organization_id, agente_id, ruta_id
    INTO v_org, v_agente_id, v_ruta_id
    FROM public.costeo_tarifas WHERE id = _tarifa_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'tarifa no encontrada';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = v_org
        AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing'))
  ) THEN
    RAISE EXCEPTION 'no autorizado';
  END IF;

  IF _estado = 'rechazada' AND (coalesce(btrim(_motivo), '') = '' OR length(btrim(_motivo)) < 5) THEN
    RAISE EXCEPTION 'el motivo de rechazo es obligatorio (mínimo 5 caracteres)';
  END IF;

  IF _estado = 'vigente' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'vigente',
           motivo_rechazo = NULL,
           aprobada_por = auth.uid(),
           aprobada_en = now(),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSIF _estado = 'rechazada' THEN
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'rechazada',
           motivo_rechazo = btrim(_motivo),
           updated_at = now()
     WHERE id = _tarifa_id;
  ELSE
    UPDATE public.costeo_tarifas
       SET estado_aprobacion = 'borrador',
           motivo_rechazo = NULL,
           updated_at = now()
     WHERE id = _tarifa_id;
  END IF;

  SELECT user_id INTO v_agente_user
    FROM public.agente_users
   WHERE agente_id = v_agente_id
   ORDER BY created_at ASC, id ASC
   LIMIT 1;

  IF v_agente_user IS NOT NULL AND _estado IN ('vigente','rechazada') THEN
    SELECT (po.name || ' → ' || pd.name)
      INTO v_ruta_txt
      FROM public.costeo_rutas r
      JOIN public.puertos po ON po.id = r.puerto_origen_id
      JOIN public.puertos pd ON pd.id = r.puerto_destino_id
     WHERE r.id = v_ruta_id;

    -- B-066: la columna real es usuario_id (antes user_id → 42703).
    INSERT INTO public.notificaciones_internas (
      organization_id, usuario_id, tipo, titulo, mensaje, leida
    ) VALUES (
      v_org, v_agente_user,
      CASE WHEN _estado = 'vigente' THEN 'tarifa_aprobada' ELSE 'tarifa_rechazada' END,
      CASE WHEN _estado = 'vigente' THEN 'Tarifa aprobada' ELSE 'Tarifa rechazada' END,
      CASE WHEN _estado = 'vigente'
           THEN 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue aprobada y ya está vigente.'
           ELSE 'Tu tarifa ' || coalesce(v_ruta_txt,'') || ' fue rechazada. Motivo: ' || btrim(_motivo)
      END,
      false
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agente_aprobar_tarifa(uuid, text, text) TO authenticated;

-- ============================================================
-- FIX B-071 + B-080 · Vista de tarifas vigentes
-- ============================================================
CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v
WITH (security_invoker = on) AS
 SELECT t.id, t.organization_id, t.agente_id, a.nombre AS agente_nombre, a.dias_credito,
    t.naviera_id, n.name AS naviera_nombre, t.ruta_id, r.puerto_origen_id, r.puerto_destino_id,
    po.name AS puerto_origen_nombre, pd.name AS puerto_destino_nombre,
    t.tipo_contenedor_id, tc.name AS tipo_contenedor_nombre,
    t.moneda, t.flete_base,
    COALESCE((SELECT sum(rc.monto) FROM costeo_tarifa_recargos rc
              WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS recargos_total,
    t.flete_base + COALESCE((SELECT sum(rc.monto) FROM costeo_tarifa_recargos rc
              WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS total_comparable,
    t.dias_libres_demoras, t.transit_time_dias, t.vigente_desde, t.vigente_hasta, t.estado,
    nc.id AS naviera_condicion_id,
    COALESCE(nc.tiene_carta_garantia, false) AS naviera_tiene_carta_garantia,
    nc.carta_garantia_vigente_hasta AS naviera_carta_garantia_vigente_hasta,
    (nc.tiene_carta_garantia = true AND nc.carta_garantia_vigente_hasta IS NOT NULL
       AND nc.carta_garantia_vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City')::date) AS naviera_carta_garantia_activa,
    nc.dias_libres_demoras_default AS naviera_dias_libres_default,
    (SELECT dt.monto_por_dia FROM costeo_naviera_demoras_tarifa dt
      WHERE dt.naviera_condicion_id = nc.id AND dt.tipo_contenedor_id = t.tipo_contenedor_id
        AND dt.desde_dia <= 6 AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6)
      ORDER BY dt.desde_dia DESC LIMIT 1)
      AS naviera_demora_dia_6,
    t.dias_libres_almacenaje_lcl,
    COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
    nc.frecuencia AS naviera_frecuencia,
    t.frecuencia_override AS tarifa_frecuencia_override
   FROM costeo_tarifas t
   JOIN costeo_agentes a ON a.id = t.agente_id
   JOIN navieras n ON n.id = t.naviera_id
   JOIN costeo_rutas r ON r.id = t.ruta_id
   JOIN puertos po ON po.id = r.puerto_origen_id
   JOIN puertos pd ON pd.id = r.puerto_destino_id
   JOIN tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
   LEFT JOIN costeo_navieras_condiciones nc
     ON nc.naviera_id = t.naviera_id AND nc.organization_id = t.organization_id
  WHERE t.estado_aprobacion = 'vigente'::text
    AND t.estado::text = 'vigente'
    AND a.activo = true
    AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City')::date);

GRANT SELECT ON public.costeo_tarifas_vigentes_v TO authenticated;
GRANT SELECT ON public.costeo_tarifas_vigentes_v TO service_role;

-- ============================================================
-- FIX B-067 + B-072 · Trigger de reemplazo de tarifas
-- ============================================================
CREATE OR REPLACE FUNCTION public.costeo_tarifas_marcar_reemplazadas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF NEW.estado <> 'vigente' OR NEW.estado_aprobacion <> 'vigente' THEN
    RETURN NEW;
  END IF;
  IF NEW.vigente_hasta IS NOT NULL AND NEW.vigente_hasta < v_hoy_mx THEN
    RETURN NEW;
  END IF;

  UPDATE public.costeo_tarifas
     SET estado = 'reemplazada',
         reemplazada_por = NEW.id,
         updated_at = now()
   WHERE organization_id = NEW.organization_id
     AND agente_id = NEW.agente_id
     AND naviera_id = NEW.naviera_id
     AND ruta_id = NEW.ruta_id
     AND tipo_contenedor_id = NEW.tipo_contenedor_id
     AND id <> NEW.id
     AND estado = 'vigente'
     AND reemplazada_por IS NULL
     AND vigente_desde <= NEW.vigente_desde
     AND vigente_hasta >= NEW.vigente_desde;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_tarifas_marcar_reemplazadas ON public.costeo_tarifas;
CREATE TRIGGER trg_costeo_tarifas_marcar_reemplazadas
AFTER INSERT OR UPDATE OF estado, estado_aprobacion ON public.costeo_tarifas
FOR EACH ROW EXECUTE FUNCTION public.costeo_tarifas_marcar_reemplazadas();

-- ============================================================
-- FIX B-079 · Estado 'vencida' derivado por fecha
-- ============================================================
CREATE OR REPLACE FUNCTION public.costeo_tarifa_estado_actual(
  p_estado text, p_vigente_hasta date
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_estado IN ('borrador','reemplazada') THEN p_estado
           WHEN p_vigente_hasta IS NOT NULL
                AND p_vigente_hasta < (now() AT TIME ZONE 'America/Mexico_City')::date
             THEN 'vencida'
           ELSE 'vigente'
         END;
$$;

COMMENT ON FUNCTION public.costeo_tarifa_estado_actual(text, date) IS
  'Estado efectivo de una tarifa de costeo derivado de su vigencia (hoy America/Mexico_City). Fuente única consumida por trigger, vista y consumidores SQL.';

CREATE OR REPLACE FUNCTION public.trg_costeo_tarifas_estado_derivado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.estado := public.costeo_tarifa_estado_actual(NEW.estado, NEW.vigente_hasta);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_tarifas_estado_derivado ON public.costeo_tarifas;
CREATE TRIGGER trg_costeo_tarifas_estado_derivado
BEFORE INSERT OR UPDATE OF estado, vigente_desde, vigente_hasta ON public.costeo_tarifas
FOR EACH ROW EXECUTE FUNCTION public.trg_costeo_tarifas_estado_derivado();

UPDATE public.costeo_tarifas
   SET estado = public.costeo_tarifa_estado_actual(estado, vigente_hasta),
       updated_at = now()
 WHERE estado IN ('vigente','vencida')
   AND estado IS DISTINCT FROM public.costeo_tarifa_estado_actual(estado, vigente_hasta);

REVOKE ALL ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.costeo_tarifas_marcar_reemplazadas() TO service_role;
