CREATE OR REPLACE FUNCTION public.sugerir_embarques_para_proveedor(
  _proveedor_id uuid,
  _organization_id uuid,
  _limit int DEFAULT 10
)
RETURNS TABLE (
  embarque_id uuid,
  expediente text,
  cliente_nombre text,
  estado text,
  etd date,
  eta date,
  match_tipo text,
  score int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _prov_nombre text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _organization_id AND m.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT lower(nombre) INTO _prov_nombre
  FROM public.proveedores
  WHERE id = _proveedor_id AND organization_id = _organization_id;

  IF _prov_nombre IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      e.id AS embarque_id,
      e.expediente,
      e.cliente_nombre,
      e.estado::text AS estado,
      e.etd,
      e.eta,
      'Nombre coincide (agente/naviera/transportista)'::text AS match_tipo,
      100 AS score
    FROM public.embarques e
    WHERE e.organization_id = _organization_id
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND (
        lower(coalesce(e.agente,'')) = _prov_nombre
        OR lower(coalesce(e.naviera,'')) = _prov_nombre
        OR lower(coalesce(e.transportista,'')) = _prov_nombre
        OR lower(coalesce(e.aerolinea,'')) = _prov_nombre
      )

    UNION ALL

    SELECT
      e.id, e.expediente, e.cliente_nombre, e.estado::text, e.etd, e.eta,
      'Tarifa vinculada (agente)'::text,
      80
    FROM public.embarques e
    JOIN public.costeo_tarifas t ON t.id = e.tarifa_id_aplicada
    JOIN public.costeo_agentes a ON a.id = t.agente_id
    WHERE e.organization_id = _organization_id
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND a.proveedor_id = _proveedor_id

    UNION ALL

    SELECT
      e.id, e.expediente, e.cliente_nombre, e.estado::text, e.etd, e.eta,
      'Tarifa vinculada (naviera)'::text,
      80
    FROM public.embarques e
    JOIN public.costeo_tarifas t ON t.id = e.tarifa_id_aplicada
    JOIN public.costeo_navieras_condiciones nc
      ON nc.naviera_id = t.naviera_id AND nc.organization_id = e.organization_id
    WHERE e.organization_id = _organization_id
      AND e.estado NOT IN ('Cerrado','Cancelado','Entregado')
      AND nc.proveedor_id = _proveedor_id
  )
  SELECT DISTINCT ON (c.embarque_id)
    c.embarque_id, c.expediente, c.cliente_nombre, c.estado, c.etd, c.eta, c.match_tipo, c.score
  FROM candidatos c
  ORDER BY c.embarque_id, c.score DESC, c.eta DESC NULLS LAST
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sugerir_embarques_para_proveedor(uuid, uuid, int) TO authenticated;