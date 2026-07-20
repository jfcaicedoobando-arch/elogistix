
-- v13.303.2 (FIX-04.1): recuperación de claims PENDING huérfanos en facturas.facturapi_id.
-- Añade timestamp del claim y un RPC seguro para liberarlo pasado un umbral.

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS facturapi_claim_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_facturas_facturapi_pending
  ON public.facturas (organization_id, facturapi_claim_at)
  WHERE facturapi_id LIKE 'PENDING:%';

COMMENT ON COLUMN public.facturas.facturapi_claim_at IS
  'Momento en el que facturapi-emitir reclamó la fila con PENDING:<uuid>. NULL cuando ya no hay claim activo.';

-- Libera un claim PENDING huérfano cuando ya pasó el umbral de gracia.
-- Devuelve TRUE si liberó, FALSE si no aplicaba (no era PENDING o aún dentro del umbral).
-- No verifica FacturAPI: el llamador debe hacerlo primero (edge function facturapi-recuperar-claim)
-- para promover la fila cuando el CFDI sí se timbró aunque perdimos la respuesta.
CREATE OR REPLACE FUNCTION public.liberar_claim_facturapi_huerfano(
  p_factura_id uuid,
  p_min_edad_minutos int DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_liberado boolean := false;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.facturas
  WHERE id = p_factura_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Autorización: sólo miembros de la organización pueden liberar claims.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.facturas
  SET facturapi_id = NULL,
      facturapi_claim_at = NULL
  WHERE id = p_factura_id
    AND facturapi_id LIKE 'PENDING:%'
    AND facturapi_claim_at IS NOT NULL
    AND facturapi_claim_at < now() - make_interval(mins => GREATEST(p_min_edad_minutos, 1));

  GET DIAGNOSTICS v_liberado = ROW_COUNT;
  RETURN v_liberado;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_claim_facturapi_huerfano(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_claim_facturapi_huerfano(uuid, int) TO authenticated;
