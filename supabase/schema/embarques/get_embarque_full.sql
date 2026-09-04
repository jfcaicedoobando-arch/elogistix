CREATE OR REPLACE FUNCTION public.get_embarque_full(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM embarques WHERE id = p_embarque_id) THEN NULL
    ELSE jsonb_build_object(
      'embarque', (
        SELECT to_jsonb(s)
               || COALESCE((
                    SELECT to_jsonb(i) - 'id' - 'organization_id'
                    FROM embarques_interno_v i WHERE i.id = s.id
                  ), '{}'::jsonb)
        FROM (
          SELECT e.id, e.expediente, e.cliente_id, e.cliente_nombre, e.modo, e.tipo,
                 e.shipper, e.consignatario, e.descripcion_mercancia, e.peso_kg,
                 e.volumen_m3, e.piezas, e.incoterm, e.estado, e.operador,
                 e.puerto_origen, e.puerto_destino, e.naviera, e.bl_master, e.bl_house,
                 e.tipo_servicio, e.contenedor, e.tipo_contenedor,
                 e.aeropuerto_origen, e.aeropuerto_destino, e.aerolinea, e.mawb, e.hawb,
                 e.ciudad_origen, e.ciudad_destino, e.transportista, e.carta_porte,
                 e.etd, e.eta, e.fecha_llegada_real, e.fecha_creacion,
                 e.tipo_cambio_usd, e.tipo_cambio_eur, e.created_at, e.updated_at,
                 e.tipo_carga, e.msds_archivo, e.agente, e.cotizacion_id,
                 e.organization_id, e.tiene_proforma, e.etd_original, e.eta_original,
                 e.deleted_at, e.deleted_by, e.created_by, e.vendedora_id, e.tarifa_id,
                 e.carta_garantia, e.dias_libres_destino, e.dias_almacenaje, e.seguro,
                 e.valor_seguro_usd, e.notas, e.cerrado_at, e.cerrado_por,
                 e.reabierto_at, e.reabierto_por, e.tarifa_id_original,
                 e.tarifa_id_aplicada, e.tarifa_decision, e.tarifa_revalidada_en,
                 e.tarifa_revalidada_por, e.facturado_historico,
                 e.cobro_cliente_status, e.cobro_cliente_actualizado_at,
                 e.agente_id, e.naviera_id, e.sin_comision
          FROM embarques e WHERE e.id = p_embarque_id
        ) s
      ),
      'conceptosVenta', COALESCE((
        SELECT jsonb_agg(to_jsonb(cv.*) ORDER BY cv.created_at, cv.id)
        FROM conceptos_venta cv
        WHERE cv.embarque_id = p_embarque_id
          AND cv.deleted_at IS NULL
      ), '[]'::jsonb),
      'conceptosCosto', COALESCE((
        SELECT jsonb_agg(to_jsonb(cc.*) ORDER BY cc.created_at, cc.id)
        FROM conceptos_costo cc
        WHERE cc.embarque_id = p_embarque_id
          AND cc.deleted_at IS NULL
      ), '[]'::jsonb),
      'documentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at, d.id)
        FROM documentos_embarque d
        WHERE d.embarque_id = p_embarque_id
          AND d.deleted_at IS NULL
      ), '[]'::jsonb),
      'notas', COALESCE((
        SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.fecha DESC)
        FROM notas_embarque n
        WHERE n.embarque_id = p_embarque_id
          AND n.deleted_at IS NULL
      ), '[]'::jsonb),
      'facturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at, f.id)
        FROM facturas f
        WHERE f.embarque_id = p_embarque_id
          AND f.deleted_at IS NULL
      ), '[]'::jsonb)
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.get_embarque_full(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_embarque_full(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_embarque_full(uuid) TO authenticated, service_role;