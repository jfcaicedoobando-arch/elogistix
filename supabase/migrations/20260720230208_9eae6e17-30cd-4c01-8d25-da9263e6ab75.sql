-- v13.303.22 — Reordena el ciclo de vida del embarque y deprecia `Llegada`.
-- Nuevo happy path: Borrador → Confirmado → En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado.
-- `Llegada` se conserva en el enum pero fuera del workflow, con salida de rescate.

CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(
  p_actual public.estado_embarque,
  p_nuevo  public.estado_embarque
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    -- v13.303.21: Borrador salta directo a Confirmado (Propuesta eliminada).
    WHEN 'Borrador'    THEN p_nuevo IN ('Confirmado')
    -- v13.303.21: Cotización deprecado, con rescate.
    WHEN 'Cotización'  THEN p_nuevo IN ('Confirmado','Borrador')
    -- v13.303.21: sólo permite regresar a Borrador si se necesita reeditar.
    WHEN 'Confirmado'  THEN p_nuevo IN ('En Tránsito','Borrador')
    -- v13.303.22: nuevo orden — En Tránsito avanza directo a Arribo.
    WHEN 'En Tránsito' THEN p_nuevo IN ('Arribo','En Proceso')
    -- v13.303.22: Arribo avanza a En Aduana (nuevo orden), permite retroceso.
    WHEN 'Arribo'      THEN p_nuevo IN ('En Aduana','En Tránsito')
    -- v13.303.22: En Aduana avanza a Entregado (nuevo orden), permite retroceso.
    WHEN 'En Aduana'   THEN p_nuevo IN ('Entregado','Arribo')
    -- v13.303.22: Llegada deprecado. Salida de rescate hacia Arribo o En Aduana.
    WHEN 'Llegada'     THEN p_nuevo IN ('Arribo','En Aduana')
    WHEN 'Entregado'   THEN p_nuevo IN ('EIR','En Aduana')
    WHEN 'EIR'         THEN p_nuevo IN ('Cerrado','Entregado')
    WHEN 'Cerrado'     THEN p_nuevo IN ('EIR')
    -- v13.303.22: En Proceso puede volver al flujo por Arribo o En Aduana.
    WHEN 'En Proceso'  THEN p_nuevo IN ('En Tránsito','Arribo','En Aduana')
    WHEN 'Cancelado'   THEN false
    ELSE false
  END;
END;
$$;

COMMENT ON FUNCTION public.transicion_embarque_valida(public.estado_embarque, public.estado_embarque) IS
'v13.303.22 (Bug 12 auditoría G): grafo dirigido de transiciones. Nuevo orden: En Tránsito → Arribo → En Aduana → Entregado → EIR → Cerrado. Llegada queda deprecado (rescate a Arribo/En Aduana).';

-- Migrar el único embarque atorado en Llegada al nuevo estado equivalente (Arribo).
-- La transición Llegada → Arribo está permitida por el nuevo grafo, así que no
-- necesita bypass del trigger.
UPDATE public.embarques
SET estado = 'Arribo'::public.estado_embarque
WHERE estado = 'Llegada';
