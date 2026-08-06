CREATE OR REPLACE FUNCTION public.conciliacion_resumen(p_cuenta_bancaria_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_movimientos',  COUNT(*),
    'pendientes',         COUNT(*) FILTER (WHERE estado_conciliacion = 'Pendiente'),
    'conciliados',        COUNT(*) FILTER (WHERE estado_conciliacion = 'Conciliado'),
    'ignorados',          COUNT(*) FILTER (WHERE estado_conciliacion = 'Ignorado'),
    'cargos_pendientes',  COALESCE(SUM(cargo) FILTER (WHERE estado_conciliacion = 'Pendiente'), 0),
    'abonos_pendientes',  COALESCE(SUM(abono) FILTER (WHERE estado_conciliacion = 'Pendiente'), 0)
  ) INTO v_result
  FROM bbva_movimientos
  WHERE cuenta_bancaria_id = p_cuenta_bancaria_id
    AND deleted_at IS NULL
    AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'));
  RETURN v_result;
END;
$function$;