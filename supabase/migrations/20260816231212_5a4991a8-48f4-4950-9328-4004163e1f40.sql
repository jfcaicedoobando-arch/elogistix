CREATE OR REPLACE FUNCTION public.crm_higiene_oportunidades()
 RETURNS TABLE(id uuid, nombre text, cliente_nombre text, etapa_id uuid, etapa_nombre text, vendedor_email text, monto_estimado numeric, moneda text, probabilidad numeric, fecha_estimada_cierre date, ultimo_movimiento_at timestamp with time zone, dias_sin_movimiento integer, sla_dias integer, estado_higiene text, registro_completo boolean, proxima_actividad_at timestamp with time zone, actividad_vencida boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT o.id, o.nombre, o.cliente_nombre, o.etapa_id, e.nombre AS etapa_nombre,
           o.vendedor_email, o.monto_estimado, o.moneda::text AS moneda, o.probabilidad,
           o.fecha_estimada_cierre,
           COALESCE(o.ultimo_movimiento_at, o.updated_at, o.created_at) AS ultimo_movimiento_at,
           COALESCE(NULLIF(e.sla_dias, 0), NULLIF(e.dias_seguimiento, 0), 7) AS sla_dias,
           (SELECT MIN(a.fecha_programada)
              FROM public.crm_actividades a
             WHERE a.entidad_tipo = 'oportunidad'::public.crm_entidad_tipo
               AND a.entidad_id = o.id
               AND a.deleted_at IS NULL
               AND a.fecha_completada IS NULL) AS proxima_actividad_at
      FROM public.crm_oportunidades o
      JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
     WHERE o.deleted_at IS NULL
       AND e.tipo = 'abierta'::public.crm_etapa_tipo
  )
  SELECT b.id, b.nombre, b.cliente_nombre, b.etapa_id, b.etapa_nombre, b.vendedor_email,
         b.monto_estimado, b.moneda, b.probabilidad, b.fecha_estimada_cierre,
         b.ultimo_movimiento_at,
         GREATEST(0, (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400)::int) AS dias_sin_movimiento,
         b.sla_dias,
         CASE
           WHEN (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400) > b.sla_dias THEN 'vencida'
           WHEN (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400) >= (b.sla_dias * 0.7) THEN 'por_vencer'
           ELSE 'en_tiempo'
         END AS estado_higiene,
         (COALESCE(b.monto_estimado, 0) > 0
          AND b.fecha_estimada_cierre IS NOT NULL
          AND COALESCE(b.vendedor_email, '') <> ''
          AND b.proxima_actividad_at IS NOT NULL) AS registro_completo,
         b.proxima_actividad_at,
         (b.proxima_actividad_at IS NOT NULL AND b.proxima_actividad_at < now()) AS actividad_vencida
    FROM base b;
$function$;