CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v
WITH (security_invoker = on) AS
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
    COALESCE(( SELECT sum(rc.monto) AS sum
           FROM costeo_tarifa_recargos rc
          WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS recargos_total,
    t.flete_base + COALESCE(( SELECT sum(rc.monto) AS sum
           FROM costeo_tarifa_recargos rc
          WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS total_comparable,
    t.dias_libres_demoras,
    t.transit_time_dias,
    t.vigente_desde,
    t.vigente_hasta,
    t.estado,
    nc.id AS naviera_condicion_id,
    COALESCE(nc.tiene_carta_garantia, false) AS naviera_tiene_carta_garantia,
    nc.carta_garantia_vigente_hasta AS naviera_carta_garantia_vigente_hasta,
    nc.tiene_carta_garantia = true AND nc.carta_garantia_vigente_hasta IS NOT NULL AND nc.carta_garantia_vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City'::text)::date AS naviera_carta_garantia_activa,
    nc.dias_libres_demoras_default AS naviera_dias_libres_default,
    ( SELECT dt.monto_por_dia
           FROM costeo_naviera_demoras_tarifa dt
          WHERE dt.naviera_condicion_id = nc.id AND dt.tipo_contenedor_id = t.tipo_contenedor_id AND dt.desde_dia <= 6 AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6)
          ORDER BY dt.desde_dia DESC
         LIMIT 1) AS naviera_demora_dia_6,
    t.dias_libres_almacenaje_lcl,
    COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
    nc.frecuencia AS naviera_frecuencia,
    t.frecuencia_override AS tarifa_frecuencia_override,
    -- Etapa 2 (identidad inequívoca de puertos): contexto UN/LOCODE + país.
    po.code AS puerto_origen_code,
    po.country AS puerto_origen_country,
    pd.code AS puerto_destino_code,
    pd.country AS puerto_destino_country
   FROM costeo_tarifas t
     JOIN costeo_agentes a ON a.id = t.agente_id
     JOIN navieras n ON n.id = t.naviera_id
     JOIN costeo_rutas r ON r.id = t.ruta_id
     JOIN puertos po ON po.id = r.puerto_origen_id
     JOIN puertos pd ON pd.id = r.puerto_destino_id
     JOIN tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
     LEFT JOIN costeo_navieras_condiciones nc ON nc.naviera_id = t.naviera_id AND nc.organization_id = t.organization_id
  WHERE t.estado_aprobacion = 'vigente'::text AND t.estado = 'vigente'::text AND a.activo = true AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City'::text)::date);