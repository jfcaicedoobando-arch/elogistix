
DELETE FROM public.organization_members
WHERE user_id = '7c95b249-89e3-4e31-8bd6-e52344cb1311'
  AND organization_id = '95fe7022-38d8-42fc-b712-24a833ba600a';

UPDATE public.organizations
SET activo = false,
    nombre = nombre || ' (archivada)'
WHERE id = '95fe7022-38d8-42fc-b712-24a833ba600a'
  AND activo = true;

CREATE OR REPLACE FUNCTION public.embarques_admin_pendientes_count()
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_count int := 0;
BEGIN
  v_org := public.current_user_org_id();

  IF v_org IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM embarques e
  WHERE e.organization_id = v_org
    AND e.estado IN ('Entregado', 'EIR')
    AND e.deleted_at IS NULL
    AND (
      EXISTS (
        SELECT 1 FROM facturas f
        WHERE f.embarque_id = e.id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada'
        GROUP BY f.embarque_id
        HAVING SUM(f.total) > COALESCE((
          SELECT SUM(pf.monto) FROM pagos_factura pf
          JOIN facturas fi ON fi.id = pf.factura_id
          WHERE fi.embarque_id = e.id AND fi.deleted_at IS NULL AND fi.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM proveedor_facturas pf
        WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        GROUP BY pf.embarque_id
        HAVING SUM(pf.total) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
          WHERE pfx.embarque_id = e.id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM documentos_embarque de
        WHERE de.embarque_id = e.id AND de.deleted_at IS NULL
          AND (de.archivo IS NULL OR de.archivo = '')
          AND de.estado <> 'No aplica'
      )
      OR (
        COALESCE((SELECT SUM(total) FROM conceptos_venta WHERE embarque_id = e.id AND deleted_at IS NULL),0)
        > COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = e.id AND deleted_at IS NULL AND estado <> 'Cancelada'),0) + 0.01
      )
    );

  RETURN v_count;
END;
$function$;
