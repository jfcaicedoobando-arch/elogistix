CREATE OR REPLACE FUNCTION public.get_embarque_full(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM embarques WHERE id = p_embarque_id) THEN NULL
    ELSE jsonb_build_object(
      'embarque', (
        SELECT to_jsonb(e.*) FROM embarques e WHERE e.id = p_embarque_id
      ),
      'conceptosVenta', COALESCE((
        SELECT jsonb_agg(to_jsonb(cv.*) ORDER BY cv.created_at, cv.id)
        FROM conceptos_venta cv
        WHERE cv.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'conceptosCosto', COALESCE((
        SELECT jsonb_agg(to_jsonb(cc.*) ORDER BY cc.created_at, cc.id)
        FROM conceptos_costo cc
        WHERE cc.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'documentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at, d.id)
        FROM documentos_embarque d
        WHERE d.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'notas', COALESCE((
        SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.fecha DESC)
        FROM notas_embarque n
        WHERE n.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'facturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at, f.id)
        FROM facturas f
        WHERE f.embarque_id = p_embarque_id
      ), '[]'::jsonb)
    )
  END;
$function$;