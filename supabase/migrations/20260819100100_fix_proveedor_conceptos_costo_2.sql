-- v13.509.0 · Resolución tolerante de proveedor por nombre + backfill 2/2.
-- (Aplicada vía el tool de migraciones; se conserva aquí para el historial.)
CREATE OR REPLACE FUNCTION public._resolver_proveedor_por_nombre(p_org uuid, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text := upper(btrim(COALESCE(p_nombre, '')));
  v_id uuid;
  v_n integer;
  v_txt text;
BEGIN
  IF v_nombre = '' THEN RETURN NULL; END IF;

  SELECT p.id INTO v_id
    FROM public.proveedores p
   WHERE p.organization_id = p_org
     AND p.deleted_at IS NULL
     AND upper(btrim(p.nombre)) = v_nombre
   ORDER BY p.created_at
   LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT count(*), min(p.id::text) INTO v_n, v_txt
    FROM public.proveedores p
   WHERE p.organization_id = p_org
     AND p.deleted_at IS NULL
     AND upper(btrim(p.nombre)) LIKE v_nombre || '%';
  IF v_n = 1 THEN RETURN v_txt::uuid; END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._resolver_proveedor_por_nombre(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._resolver_proveedor_por_nombre(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public._resolver_proveedor_por_nombre(uuid, text) TO authenticated, service_role;

WITH unico AS (
  SELECT c.cotizacion_id, min(btrim(c.proveedor)) AS proveedor
    FROM public.cotizacion_costos c
   WHERE c.deleted_at IS NULL
     AND COALESCE(btrim(c.proveedor), '') <> ''
   GROUP BY c.cotizacion_id
  HAVING count(DISTINCT upper(btrim(c.proveedor))) = 1
)
UPDATE public.conceptos_costo cc
   SET proveedor_nombre = u.proveedor
  FROM public.embarques e
  JOIN unico u ON u.cotizacion_id = e.cotizacion_id
 WHERE cc.embarque_id = e.id
   AND cc.deleted_at IS NULL
   AND cc.proveedor_id IS NULL
   AND COALESCE(btrim(cc.proveedor_nombre), '') = ''
   AND COALESCE(cc.estado_liquidacion::text, 'Pendiente') <> 'Pagado';

UPDATE public.conceptos_costo cc
   SET proveedor_id = public._resolver_proveedor_por_nombre(cc.organization_id, cc.proveedor_nombre)
 WHERE cc.deleted_at IS NULL
   AND cc.proveedor_id IS NULL
   AND COALESCE(btrim(cc.proveedor_nombre), '') <> ''
   AND public._resolver_proveedor_por_nombre(cc.organization_id, cc.proveedor_nombre) IS NOT NULL;
