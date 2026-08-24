-- ============================================================================
-- FIX2 ronda 2 · B-1: sellar fuga de columnas internas de embarques al portal.
-- RLS filtra filas, no columnas: un usuario `cliente` con acceso a su fila
-- podía pedir select=* y leer PnL interno. Se revocan privilegios de columna
-- y el staff lee esas columnas por una vista owner-run con guarda explícita.
-- ============================================================================

CREATE OR REPLACE VIEW public.embarques_interno_v AS
SELECT
  e.id,
  e.organization_id,
  e.cerrado_snapshot,
  e.tarifa_delta_jsonb,
  e.reabierto_motivo,
  e.created_by_email
FROM public.embarques e
WHERE public.is_org_member(e.organization_id)
  AND NOT public.has_role((SELECT auth.uid()), 'cliente'::app_role)
  AND NOT public.has_role((SELECT auth.uid()), 'agente_carga'::app_role);

COMMENT ON VIEW public.embarques_interno_v IS
  'FIX2 B-1: columnas internas de embarques (PnL de cierre, delta de tarifa, motivo de reapertura, correo del creador). Owner-run: la guarda es is_org_member + exclusión de roles de portal (cliente, agente_carga).';

REVOKE ALL ON public.embarques_interno_v FROM PUBLIC;
REVOKE ALL ON public.embarques_interno_v FROM anon;
GRANT SELECT ON public.embarques_interno_v TO authenticated;
GRANT SELECT ON public.embarques_interno_v TO service_role;

REVOKE SELECT (cerrado_snapshot, tarifa_delta_jsonb, reabierto_motivo, created_by_email)
  ON public.embarques FROM authenticated;
REVOKE SELECT (cerrado_snapshot, tarifa_delta_jsonb, reabierto_motivo, created_by_email)
  ON public.embarques FROM anon;

-- get_embarque_full es SECURITY INVOKER y usaba to_jsonb(e.*), que exige
-- privilegio sobre TODAS las columnas. Se arma con columnas seguras y se
-- fusionan las internas desde la vista (vacío para usuarios de portal).
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
      ), '[]'::jsonb),
      'conceptosCosto', COALESCE((
        SELECT jsonb_agg(to_jsonb(cc.*) ORDER BY cc.created_at, cc.id)
        FROM conceptos_costo cc
        WHERE cc.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'documentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at, d.id)
        FROM documentos_embarque d
        WHERE d.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'notas', COALESCE((
        SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.fecha DESC)
        FROM notas_embarque n
        WHERE n.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'facturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at, f.id)
        FROM facturas f
        WHERE f.embarque_id = p_embarque_id
      ), '[]'::jsonb)
    )
  END;
$function$;

-- ============================================================================
-- FIX2 ronda 2 · B-2: máquina canónica de estados de notas de crédito.
-- El edge de timbrado escribe Borrador→Timbrada y la UI sólo ofrece "Timbrar"
-- desde Borrador; el trigger vigente exigía pasar por Aprobada, así que el
-- primer timbrado habría fallado DESPUÉS de timbrar en FacturApi.
-- Canon: Borrador→{Timbrada,Cancelada} · Timbrada→{Aplicada,Cancelada}
--        Aplicada→{Cancelada} · Aprobada (legado, sólo salida)→{Timbrada,Cancelada}
-- ============================================================================
CREATE OR REPLACE FUNCTION public.guard_nc_cliente_transicion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old text;
  v_new text := NEW.estado::text;
BEGIN
  IF NEW.estado::text IN ('Timbrada','Aplicada')
     AND COALESCE(NULLIF(TRIM(NEW.uuid_fiscal), ''), NULL) IS NULL THEN
    RAISE EXCEPTION 'LC_NC_UUID_REQUERIDO: timbra la nota de crédito (folio fiscal UUID) antes de marcarla como %', v_new
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := OLD.estado::text;
    IF v_old IS DISTINCT FROM v_new THEN
      IF NOT (
        (v_old = 'Borrador'  AND v_new IN ('Timbrada','Cancelada')) OR
        (v_old = 'Timbrada'  AND v_new IN ('Aplicada','Cancelada')) OR
        (v_old = 'Aplicada'  AND v_new = 'Cancelada') OR
        (v_old = 'Aprobada'  AND v_new IN ('Timbrada','Cancelada'))
      ) THEN
        RAISE EXCEPTION 'LC_NC_TRANSICION_INVALIDA: no se puede pasar la nota de crédito de % a %', v_old, v_new
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_nc_cliente_transicion() IS
  'Máquina canónica de estados de NC de cliente (FIX2 ronda 2): Borrador→{Timbrada,Cancelada}, Timbrada→{Aplicada,Cancelada}, Aplicada→{Cancelada}. Aprobada es legado de sólo salida. Espejo de src/features/facturacion/services/notasCredito.ts.';

-- ============================================================================
-- FIX2 ronda 2 · B-3: puede_escribir_cotizaciones = espejo exacto de SALES
-- (src/lib/access/permissionMatrix.ts): entra admin_org, sale operador.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.puede_escribir_cotizaciones(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'super_admin'::app_role)
    OR public.has_role(_user_id, 'admin_org'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gerente_comercial'::app_role)
    OR public.has_role(_user_id, 'vendedor'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO service_role;

COMMENT ON FUNCTION public.puede_escribir_cotizaciones(uuid) IS
  'Roles con escritura en cotizaciones y sus costos. Espejo EXACTO de SALES en src/lib/access/permissionMatrix.ts (FIX2 ronda 2: entra admin_org, sale operador).';