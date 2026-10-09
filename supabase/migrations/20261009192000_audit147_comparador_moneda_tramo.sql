-- AUD147 comparator: retain the day-6 lookup; expose its own currency/range.
-- Append-only view contract. No DML, RPC replacement, GRANT, policy or FX change.
DO $migration$
DECLARE
  before_oid oid := 'public.costeo_tarifas_vigentes_v'::regclass;
  before_meta jsonb;
  after_meta jsonb;
BEGIN
  IF md5(pg_get_viewdef(before_oid,true)) <> '56e48aeef8c98a7286af5ab50ff9df4e' THEN
    RAISE EXCEPTION 'AUD147_VIEW_SOURCE_DRIFT';
  END IF;
  SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions,'rowtype',reltype)
  INTO before_meta FROM pg_class WHERE oid=before_oid;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=before_oid
      AND 'security_invoker=on'=ANY(reloptions)) THEN
    RAISE EXCEPTION 'AUD147_VIEW_SECURITY_DRIFT';
  END IF;
  EXECUTE $view$
CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v WITH (security_invoker=on) AS
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
    demora.monto_por_dia AS naviera_demora_dia_6,
    t.dias_libres_almacenaje_lcl,
    COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
    nc.frecuencia AS naviera_frecuencia,
    t.frecuencia_override AS tarifa_frecuencia_override,
    po.code AS puerto_origen_code,
    po.country AS puerto_origen_country,
    pd.code AS puerto_destino_code,
    pd.country AS puerto_destino_country,
    demora.moneda AS naviera_demora_moneda,
    demora.desde_dia AS naviera_demora_desde_dia,
    demora.hasta_dia AS naviera_demora_hasta_dia
   FROM costeo_tarifas t
     JOIN costeo_agentes a ON a.id = t.agente_id
     JOIN navieras n ON n.id = t.naviera_id
     JOIN costeo_rutas r ON r.id = t.ruta_id
     JOIN puertos po ON po.id = r.puerto_origen_id
     JOIN puertos pd ON pd.id = r.puerto_destino_id
     JOIN tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
     LEFT JOIN costeo_navieras_condiciones nc ON nc.naviera_id = t.naviera_id AND nc.organization_id = t.organization_id
     LEFT JOIN LATERAL (
       SELECT dt.monto_por_dia, dt.moneda, dt.desde_dia, dt.hasta_dia
       FROM public.costeo_naviera_demoras_tarifa dt
       WHERE dt.naviera_condicion_id = nc.id
         AND dt.tipo_contenedor_id = t.tipo_contenedor_id
         AND dt.desde_dia <= 6
         AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6)
       ORDER BY dt.desde_dia DESC
       LIMIT 1
     ) demora ON true
  WHERE t.estado_aprobacion = 'vigente'::text AND t.estado = 'vigente'::text AND a.activo = true AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= (now() AT TIME ZONE 'America/Mexico_City'::text)::date);
$view$;
  SELECT jsonb_build_object('owner',relowner,'acl',relacl,'options',reloptions,'rowtype',reltype)
  INTO after_meta FROM pg_class WHERE oid='public.costeo_tarifas_vigentes_v'::regclass;
  IF before_meta IS DISTINCT FROM after_meta
      OR before_oid <> 'public.costeo_tarifas_vigentes_v'::regclass THEN
    RAISE EXCEPTION 'AUD147_VIEW_METADATA_CHANGED';
  END IF;
END
$migration$;
