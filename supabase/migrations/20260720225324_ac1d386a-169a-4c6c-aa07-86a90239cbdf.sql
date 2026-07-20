-- v13.303.21 · Eliminación del estado intermedio "Propuesta" (Cotización) del workflow de embarques.
-- Contexto: el estado no representa una aprobación real; solo agrega clics y contamina reportes.
-- El enum `estado_embarque` mantiene el valor 'Cotización' como deprecado (rescatable en edge cases).

CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(
  p_actual public.estado_embarque,
  p_nuevo  public.estado_embarque
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Idempotente: mismo estado siempre válido.
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  -- Cualquier estado no terminal permite cancelar.
  IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    -- v13.303.21: Borrador salta directo a Confirmado (Propuesta eliminada).
    WHEN 'Borrador'    THEN p_nuevo IN ('Confirmado')
    -- v13.303.21: Cotización queda como estado deprecado. Salida de rescate
    -- para embarques legacy: pueden regresar a Borrador o avanzar a Confirmado.
    WHEN 'Cotización'  THEN p_nuevo IN ('Confirmado','Borrador')
    -- v13.303.21: eliminada la arista Confirmado → Cotización (retroceso legacy).
    -- Ahora sólo se puede regresar a Borrador si el operador necesita reeditar.
    WHEN 'Confirmado'  THEN p_nuevo IN ('En Tránsito','Borrador')
    WHEN 'En Tránsito' THEN p_nuevo IN ('En Aduana','En Proceso','Llegada')
    WHEN 'En Aduana'   THEN p_nuevo IN ('Llegada','En Tránsito')
    WHEN 'Llegada'     THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Arribo'      THEN p_nuevo IN ('Entregado','Llegada')
    WHEN 'Entregado'   THEN p_nuevo IN ('EIR','Arribo')
    WHEN 'EIR'         THEN p_nuevo IN ('Cerrado','Entregado')
    WHEN 'Cerrado'     THEN p_nuevo IN ('EIR')
    WHEN 'En Proceso'  THEN p_nuevo IN ('En Tránsito','En Aduana','Llegada','Arribo')
    WHEN 'Cancelado'   THEN false
    ELSE false
  END;
END;
$$;

COMMENT ON FUNCTION public.transicion_embarque_valida(public.estado_embarque, public.estado_embarque) IS
'v13.303.21 (Bug 12 auditoría G): grafo dirigido de transiciones válidas. Eliminado el estado intermedio Cotización/Propuesta: Borrador → Confirmado directo. Cotización se conserva como valor deprecado del enum con salida de rescate.';

-- Migrar el único embarque atorado en Cotización a Borrador.
-- La transición Cotización → Borrador ya es válida con la nueva función.
UPDATE public.embarques
   SET estado = 'Borrador', updated_at = now()
 WHERE estado = 'Cotización';
