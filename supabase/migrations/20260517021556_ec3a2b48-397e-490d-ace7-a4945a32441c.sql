-- 1) Search path inmutable
CREATE OR REPLACE FUNCTION public.is_soft_delete_table(_table text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT _table = ANY(ARRAY[
    'clientes','contactos_cliente','embarques','documentos_embarque',
    'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta'
  ])
$function$;

-- 2) Endurecer INSERT en app_logs: sólo authenticated y user_id consistente
DROP POLICY IF EXISTS "insertar logs" ON public.app_logs;

CREATE POLICY "app_logs insert authenticated"
  ON public.app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());