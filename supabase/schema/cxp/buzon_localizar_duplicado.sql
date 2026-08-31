-- Fuente canónica de public.buzon_localizar_duplicado(...).
-- 1:1 con supabase/migrations/20260831222500_buzon_duplicado_ubicacion.sql.
--
-- Origen de verdad de la deduplicación del buzón CxP: dado un hash de archivo
-- (o de XML) y/o un UUID fiscal, dice si el documento ya existe y DÓNDE está,
-- para que el operador pueda resolverlo sin pedir acceso a Compras › Facturas.
--
-- Es SECURITY DEFINER a propósito: los índices únicos de `uuid_fiscal` son
-- globales, así que un duplicado de OTRA organización igual bloquea el alta y
-- hay que reportarlo. En ese caso se devuelve caso='ajeno' SIN ids ni folio:
-- nunca se filtran datos cross-org. Los metadatos sólo viajan cuando la fila
-- pertenece a la organización del llamante (o es super_admin).
--
-- Casos:
--   'buzon_pendiente' → ya está en el buzón, aún sin capturar.
--   'mismo_embarque'  → ya capturada como factura de ESTE embarque.
--   'otro_embarque'   → ya capturada y vinculada a otro embarque de la org.
--   'sin_embarque'    → ya capturada en Compras, sin embarque vinculado.
--   'ajeno'           → duplicado no visible para el llamante (genérico).
--   NULL              → no hay duplicado.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

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

  -- 1) Documento vivo del buzón con el mismo hash (o el mismo UUID fiscal).
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

  -- 2) Factura de proveedor ya capturada con el mismo UUID fiscal, incluso si
  --    su documento del buzón ya no existe (caso 'sin_embarque').
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
      -- Documento capturado cuya factura ya no existe: se trata como duplicado
      -- sin ubicación en vez de dejar pasar un gemelo.
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
