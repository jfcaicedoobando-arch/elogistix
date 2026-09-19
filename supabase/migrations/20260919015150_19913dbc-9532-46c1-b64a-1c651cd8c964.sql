CREATE OR REPLACE FUNCTION public.liberar_claim_facturapi_huerfano(p_factura_id uuid, p_min_edad_minutos integer DEFAULT 5) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  -- P0 correctivo: limpiar atómicamente claim + intento pendiente. Si el
  -- pendiente sobrevive a la liberación, un webhook tardío del intento viejo
  -- podría localizar la fila ya recapturada y promover el CFDI equivocado.
  UPDATE public.facturas
  SET facturapi_id = NULL,
      facturapi_claim_at = NULL,
      facturapi_pendiente_id = NULL,
      facturapi_pendiente_at = NULL
  WHERE id = p_factura_id
    AND facturapi_id LIKE 'PENDING:%'
    AND facturapi_claim_at IS NOT NULL
    AND facturapi_claim_at < now() - make_interval(mins => GREATEST(p_min_edad_minutos, 1));
  GET DIAGNOSTICS v_liberado = ROW_COUNT;
  RETURN v_liberado;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_claim_facturapi_huerfano(uuid, integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.liberar_claim_rep_huerfano(p_pago_id uuid, p_min_edad_minutos integer DEFAULT 5) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  -- P0 correctivo: limpiar atómicamente claim + intento pendiente del REP.
  UPDATE public.pagos_factura
  SET facturapi_rep_id = NULL,
      facturapi_rep_claim_at = NULL,
      facturapi_rep_pendiente_id = NULL,
      facturapi_rep_pendiente_at = NULL
  WHERE id = p_pago_id
    AND facturapi_rep_id LIKE 'PENDING:%'
    AND facturapi_rep_claim_at IS NOT NULL
    AND facturapi_rep_claim_at < now() - make_interval(mins => GREATEST(p_min_edad_minutos, 1));
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN v_filas > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_claim_rep_huerfano(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.liberar_claim_facturapi_huerfano(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_claim_rep_huerfano(uuid, integer) TO authenticated, service_role;