-- Guardado atómico del embarque y sus contenedores.
-- Las dos RPC existentes siguen disponibles para sus otros consumidores.
CREATE OR REPLACE FUNCTION public.actualizar_embarque_con_contenedores(
  p_embarque_id uuid,
  p_embarque jsonb,
  p_conceptos_venta jsonb,
  p_conceptos_costo jsonb,
  p_request_id uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL,
  p_contenedores jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- El claim envuelve ambas operaciones. El RPC interno recibe NULL para no
  -- consumir la misma clave antes de sincronizar los contenedores.
  v_result := public.idempotency_claim(p_request_id, 'actualizar_embarque_con_contenedores');
  IF v_result IS NOT NULL THEN
    IF v_result ? '__idempotency_pending' THEN
      RAISE EXCEPTION 'LC_IDEMPOTENCIA_PENDIENTE: el guardado anterior sigue en curso; verifica el embarque antes de reintentar'
        USING ERRCODE = '40001';
    END IF;
    RETURN v_result;
  END IF;

  v_result := public.actualizar_embarque_completo(
    p_embarque_id,
    p_embarque,
    p_conceptos_venta,
    p_conceptos_costo,
    NULL,
    p_expected_updated_at
  );

  IF p_contenedores IS NOT NULL THEN
    PERFORM public.sincronizar_contenedores_embarque(p_embarque_id, p_contenedores);
  END IF;

  -- Si la sincronización falla, PostgreSQL revierte también el UPDATE y el claim.
  PERFORM public.idempotency_store(p_request_id, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_embarque_con_contenedores(
  uuid, jsonb, jsonb, jsonb, uuid, timestamptz, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_embarque_con_contenedores(
  uuid, jsonb, jsonb, jsonb, uuid, timestamptz, jsonb
) TO authenticated, service_role;
