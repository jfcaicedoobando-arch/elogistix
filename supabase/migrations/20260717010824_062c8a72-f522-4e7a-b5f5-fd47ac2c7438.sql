CREATE OR REPLACE FUNCTION public.historial_factura(p_factura_id uuid, p_limite integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  usuario_id uuid,
  usuario_email text,
  accion text,
  modulo text,
  entidad_id uuid,
  entidad_nombre text,
  detalles jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura_org uuid;
  v_cliente_id uuid;
  v_limite integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT f.organization_id, f.cliente_id
    INTO v_factura_org, v_cliente_id
    FROM public.facturas f
   WHERE f.id = p_factura_id
     AND f.deleted_at IS NULL;

  IF v_factura_org IS NULL THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR (
      v_factura_org = public.current_user_org_id()
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'admin_org')
        OR public.has_role(auth.uid(), 'operador')
        OR public.has_role(auth.uid(), 'contador')
        OR public.has_role(auth.uid(), 'viewer')
        OR public.has_role(auth.uid(), 'vendedor')
        OR public.has_role(auth.uid(), 'gerente_operaciones')
        OR public.has_role(auth.uid(), 'coordinador_logistico')
        OR public.has_role(auth.uid(), 'customer_service')
        OR public.has_role(auth.uid(), 'gerente_visor')
        OR public.has_role(auth.uid(), 'gerente_comercial')
        OR public.has_role(auth.uid(), 'auxiliar_contable')
        OR public.has_role(auth.uid(), 'ejecutivo_cobranza')
        OR public.has_role(auth.uid(), 'tesorero')
      )
    )
    OR (
      public.has_role(auth.uid(), 'cliente')
      AND v_cliente_id IN (SELECT public.current_user_client_ids())
    )
  ) THEN
    RAISE EXCEPTION 'factura_forbidden' USING ERRCODE = '42501';
  END IF;

  v_limite := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 100);

  RETURN QUERY
  SELECT
    ba.id,
    ba.usuario_id,
    ba.usuario_email,
    ba.accion,
    ba.modulo,
    ba.entidad_id,
    ba.entidad_nombre,
    COALESCE(ba.detalles, '{}'::jsonb) AS detalles,
    ba.created_at
  FROM public.bitacora_actividad ba
  WHERE ba.modulo IN ('facturas', 'facturacion')
    AND (
      ba.entidad_id = p_factura_id
      OR ba.detalles @> jsonb_build_object('factura_id', p_factura_id::text)
      OR ba.detalles @> jsonb_build_object('factura_original_id', p_factura_id::text)
      OR ba.detalles @> jsonb_build_object('sustituye_a_factura_id', p_factura_id::text)
      OR ba.detalles @> jsonb_build_object('sustituida_por_factura_id', p_factura_id::text)
    )
  ORDER BY ba.created_at DESC
  LIMIT v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.historial_factura(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historial_factura(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.historial_factura(uuid, integer) TO service_role;