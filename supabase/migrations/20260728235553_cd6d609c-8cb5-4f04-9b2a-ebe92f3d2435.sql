-- v13.322.1 (GHA-audit #2 · P0) — Fuga multi-tenant en get_top_tarifas.
-- La rama `p_organization_id IS NOT NULL` filtraba por la org recibida SIN
-- validar membresía: al ser SECURITY DEFINER, cualquier usuario autenticado
-- podía leer tarifas de otra organización pasando su UUID.
CREATE OR REPLACE FUNCTION public.get_top_tarifas(
  p_puerto_origen_id uuid,
  p_puerto_destino_id uuid,
  p_tipo_contenedor_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF public.costeo_tarifas_vigentes_v
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
     AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
     -- Membresía SIEMPRE obligatoria, se pase o no p_organization_id.
     AND EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v.organization_id
          AND om.user_id = auth.uid()
     )
   ORDER BY v.total_comparable ASC,
            v.dias_credito DESC NULLS LAST,
            v.dias_libres_demoras DESC NULLS LAST
   LIMIT 3;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;