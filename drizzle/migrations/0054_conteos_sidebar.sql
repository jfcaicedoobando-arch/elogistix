-- Los hashes históricos usan djb2 sobre unidades UTF-16 de JavaScript.
CREATE OR REPLACE FUNCTION public._auditoria_hallazgo_hash(p_texto text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path TO ''
AS $$
DECLARE
  caracter text;
  codigo integer;
  hash bigint := 5381;
  resultado text := '';
  alfabeto constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
BEGIN
  FOREACH caracter IN ARRAY string_to_array(p_texto, NULL) LOOP
    codigo := ascii(caracter);
    IF codigo > 65535 THEN
      hash := (hash * 33 + 55296 + (codigo - 65536) / 1024) % 4294967296;
      codigo := 56320 + (codigo - 65536) % 1024;
    END IF;
    hash := (hash * 33 + codigo) % 4294967296;
  END LOOP;

  LOOP
    resultado := substr(alfabeto, (hash % 36)::integer + 1, 1) || resultado;
    hash := hash / 36;
    EXIT WHEN hash = 0;
  END LOOP;
  RETURN resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.auditoria_pendientes_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $$
  WITH reporte AS MATERIALIZED (
    SELECT public.auditoria_embarques_org() AS datos
  )
  SELECT count(*)
  FROM reporte
  CROSS JOIN LATERAL jsonb_array_elements(reporte.datos->'hallazgos') AS hallazgo(h)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.auditoria_revisiones r
    WHERE r.organization_id = (SELECT public.current_user_org_id())
      AND r.embarque_id = (h->>'embarque_id')::uuid
      AND r.regla = h->>'regla'
      AND r.detalle_hash = public._auditoria_hallazgo_hash(
        concat(h->>'embarque_id', '|', h->>'regla', '|', h->>'detalle')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.cxp_por_pagar_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO ''
AS $$
  SELECT count(*)
  FROM public.proveedor_facturas pf
  JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente';
$$;

REVOKE ALL ON FUNCTION public._auditoria_hallazgo_hash(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.auditoria_pendientes_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cxp_por_pagar_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._auditoria_hallazgo_hash(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auditoria_pendientes_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cxp_por_pagar_count() TO authenticated, service_role;
