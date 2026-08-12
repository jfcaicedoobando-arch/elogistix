-- EF-01 (auditoría edge functions): idempotencia del timbrado de REP.
-- claim PENDING:<uuid> atómico sobre pagos_factura.facturapi_rep_id + timestamp
-- + RPC para liberar claims huérfanos pasado un umbral (patrón facturas/NC).

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS facturapi_rep_claim_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pagos_factura_rep_pending
  ON public.pagos_factura (organization_id, facturapi_rep_claim_at)
  WHERE facturapi_rep_id LIKE 'PENDING:%';

COMMENT ON COLUMN public.pagos_factura.facturapi_rep_claim_at IS
  'Momento en que facturapi-emitir-rep reclamó la fila con PENDING:<uuid>. NULL cuando ya no hay claim activo.';

-- Libera un claim PENDING huérfano de REP cuando ya pasó el umbral de gracia.
-- Devuelve TRUE si liberó, FALSE si no aplicaba. No verifica FacturAPI: el
-- llamador (edge facturapi-recuperar-claim) debe promover primero si el REP sí
-- se timbró aunque se perdió la respuesta.
CREATE OR REPLACE FUNCTION public.liberar_claim_rep_huerfano(
  p_pago_id uuid,
  p_min_edad_minutos int DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_filas int := 0;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.pagos_factura
  WHERE id = p_pago_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'pago no encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Autorización: sólo miembros de la organización pueden liberar claims.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_factura
  SET facturapi_rep_id = NULL,
      facturapi_rep_claim_at = NULL
  WHERE id = p_pago_id
    AND facturapi_rep_id LIKE 'PENDING:%'
    AND facturapi_rep_claim_at IS NOT NULL
    AND facturapi_rep_claim_at < now() - make_interval(mins => GREATEST(p_min_edad_minutos, 1));

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_claim_rep_huerfano(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_claim_rep_huerfano(uuid, int) TO authenticated, service_role;
