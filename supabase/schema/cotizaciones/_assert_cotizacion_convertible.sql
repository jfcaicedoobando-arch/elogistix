-- Fuente canónica. Espejo 1:1 de la migración v13.823.32 (ola de pulido CxP/cotización→embarque/CRM).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._assert_cotizacion_convertible(p_cotizacion_id uuid, p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado    public.estado_cotizacion;
  v_org       uuid;
  v_deleted   timestamptz;
  v_folio     text;
  v_existente uuid;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT estado, organization_id, deleted_at, folio
    INTO v_estado, v_org, v_deleted, v_folio
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id
   FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: la cotización no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización está eliminada' USING ERRCODE = 'P0001';
  END IF;
  IF p_org IS NOT NULL AND v_org IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;
  IF v_estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente
    FROM public.embarques
   WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
   LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_YA_TIENE_EMBARQUE: la cotización % ya generó un embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;
