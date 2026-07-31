CREATE OR REPLACE FUNCTION public.embarque_operativo_completo(p_embarque_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_docs_faltantes int;
  v_cont_sin_fechas int;
  v_costos_sin_factura int;
  v_buzon_pendiente int;
BEGIN
  IF p_embarque_id IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_docs_faltantes
    FROM documentos_embarque de
   WHERE de.embarque_id = p_embarque_id
     AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo = '')
     AND de.estado <> 'No aplica';

  SELECT COUNT(*) INTO v_cont_sin_fechas
    FROM embarque_contenedores ec
   WHERE ec.embarque_id = p_embarque_id
     AND ec.deleted_at IS NULL
     AND (ec.fecha_descarga IS NULL OR ec.fecha_devolucion IS NULL);

  -- Facturas de proveedor: cada concepto de costo debe estar respaldado.
  SELECT COUNT(*) INTO v_costos_sin_factura
    FROM conceptos_costo cc
   WHERE cc.embarque_id = p_embarque_id
     AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
        JOIN proveedor_facturas pf2 ON pf2.id = pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id = cc.id
         AND pf2.deleted_at IS NULL
         AND pf2.estado <> 'Cancelada');

  -- Buzón CxP: nada pendiente de capturar.
  SELECT COUNT(*) INTO v_buzon_pendiente
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id = p_embarque_id
     AND efe.deleted_at IS NULL
     AND efe.proveedor_factura_id IS NULL;

  RETURN v_docs_faltantes = 0
     AND v_cont_sin_fechas = 0
     AND v_costos_sin_factura = 0
     AND v_buzon_pendiente = 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.embarque_operativo_completo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.embarque_operativo_completo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.embarque_operativo_completo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.embarque_operativo_completo(uuid) TO service_role;