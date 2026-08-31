CREATE OR REPLACE FUNCTION public.buzon_localizar_duplicado(
  p_hash text DEFAULT NULL,
  p_columna text DEFAULT 'archivo_hash',
  p_uuid_fiscal text DEFAULT NULL,
  p_embarque_id uuid DEFAULT NULL
)
 RETURNS TABLE (
   caso text,
   factura_id uuid,
   embarque_id uuid,
   embarque_expediente text
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_super boolean := public.has_role(auth.uid(), 'super_admin');
  v_uuid text := nullif(upper(btrim(coalesce(p_uuid_fiscal, ''))), '');
  v_hash text := nullif(btrim(coalesce(p_hash, '')), '');
  v_doc public.embarque_facturas_entrantes%ROWTYPE;
  v_fac public.proveedor_facturas%ROWTYPE;
  v_visible boolean;
  v_emb_id uuid;
  v_exp text;
BEGIN
  IF p_columna NOT IN ('archivo_hash', 'xml_hash') THEN
    RAISE EXCEPTION 'LC_ARG_INVALIDO: columna de hash no soportada';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sesión requerida';
  END IF;
  IF v_hash IS NULL AND v_uuid IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_doc
    FROM public.embarque_facturas_entrantes d
   WHERE d.deleted_at IS NULL
     AND (
       (v_hash IS NOT NULL AND p_columna = 'archivo_hash' AND d.archivo_hash = v_hash)
       OR (v_hash IS NOT NULL AND p_columna = 'xml_hash' AND d.xml_hash = v_hash)
       OR (v_uuid IS NOT NULL AND upper(btrim(d.uuid_fiscal)) = v_uuid)
     )
   ORDER BY (d.estado = 'capturada') DESC, d.created_at
   LIMIT 1;

  IF FOUND THEN
    v_visible := v_super OR v_doc.organization_id = v_org;
    IF NOT v_visible THEN
      RETURN QUERY SELECT 'ajeno'::text, NULL::uuid, NULL::uuid, NULL::text;
      RETURN;
    END IF;
    IF v_doc.estado <> 'capturada' THEN
      RETURN QUERY SELECT 'buzon_pendiente'::text, NULL::uuid, v_doc.embarque_id, NULL::text;
      RETURN;
    END IF;
    SELECT * INTO v_fac FROM public.proveedor_facturas f
      WHERE f.id = v_doc.proveedor_factura_id AND f.deleted_at IS NULL;
  END IF;

  IF v_fac.id IS NULL AND v_uuid IS NOT NULL THEN
    SELECT * INTO v_fac FROM public.proveedor_facturas f
      WHERE f.deleted_at IS NULL AND upper(btrim(f.uuid_fiscal)) = v_uuid
      LIMIT 1;
    IF FOUND AND NOT (v_super OR v_fac.organization_id = v_org) THEN
      RETURN QUERY SELECT 'ajeno'::text, NULL::uuid, NULL::uuid, NULL::text;
      RETURN;
    END IF;
  END IF;

  IF v_fac.id IS NULL THEN
    IF v_doc.id IS NOT NULL THEN
      RETURN QUERY SELECT 'sin_embarque'::text, NULL::uuid, NULL::uuid, NULL::text;
    END IF;
    RETURN;
  END IF;

  v_emb_id := coalesce(v_fac.embarque_id, v_doc.embarque_id);
  IF v_emb_id IS NULL THEN
    RETURN QUERY SELECT 'sin_embarque'::text, v_fac.id, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT e.expediente INTO v_exp FROM public.embarques e
    WHERE e.id = v_emb_id AND e.deleted_at IS NULL
      AND (v_super OR e.organization_id = v_org);

  IF p_embarque_id IS NOT NULL AND v_emb_id = p_embarque_id THEN
    RETURN QUERY SELECT 'mismo_embarque'::text, v_fac.id, v_emb_id, v_exp;
  ELSE
    RETURN QUERY SELECT 'otro_embarque'::text, v_fac.id, v_emb_id, v_exp;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.buzon_localizar_duplicado(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buzon_localizar_duplicado(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buzon_localizar_duplicado(text, text, text, uuid) TO service_role;