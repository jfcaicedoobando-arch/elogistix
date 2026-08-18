-- Fuente canónica de public.transicion_embarque_valida.
-- v13.646.0 (BUG-05): un embarque 'Cerrado' no puede pasar directo a 'Cancelado';
-- primero hay que reabrirlo.

CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(p_actual estado_embarque, p_nuevo estado_embarque)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  -- BUG-09 (auditoría 2026-08-18): la regla blanket de cancelación se evaluaba
  -- antes del CASE y permitía 'Cerrado' -> 'Cancelado' con comisiones
  -- definitivas y CxC/CxP liquidadas. Un embarque cerrado debe reabrirse
  -- primero ('Por liquidar' o 'EIR') y cancelarse desde ahí.
  IF p_nuevo = 'Cancelado' AND p_actual NOT IN ('Cancelado', 'Cerrado') THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    WHEN 'Borrador'     THEN p_nuevo IN ('Confirmado')
    WHEN 'Cotización'   THEN p_nuevo IN ('Confirmado','Borrador')
    WHEN 'Confirmado'   THEN p_nuevo IN ('En Tránsito','Borrador')
    WHEN 'En Tránsito'  THEN p_nuevo IN ('Arribo','En Proceso')
    WHEN 'Arribo'       THEN p_nuevo IN ('En Aduana','En Tránsito')
    WHEN 'En Aduana'    THEN p_nuevo IN ('Entregado','Arribo')
    WHEN 'Llegada'      THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Entregado'    THEN p_nuevo IN ('EIR','En Aduana','Cerrado')
    WHEN 'EIR'          THEN p_nuevo IN ('Por liquidar','Cerrado','Entregado')
    WHEN 'Por liquidar' THEN p_nuevo IN ('Cerrado','EIR')
    WHEN 'Cerrado'      THEN p_nuevo IN ('Por liquidar','EIR')
    WHEN 'En Proceso'   THEN p_nuevo IN ('En Tránsito','Arribo','En Aduana')
    WHEN 'Cancelado'    THEN false
    ELSE false
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.transicion_embarque_valida(estado_embarque, estado_embarque) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transicion_embarque_valida(estado_embarque, estado_embarque) TO authenticated, service_role;
