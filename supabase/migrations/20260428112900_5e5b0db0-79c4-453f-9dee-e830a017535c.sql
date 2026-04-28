-- Función que retorna en una sola llamada toda la información del detalle de un embarque.
-- SECURITY INVOKER para que las políticas RLS de cada tabla apliquen al usuario actual.
-- Si el usuario no tiene acceso al embarque, devuelve NULL silenciosamente.
CREATE OR REPLACE FUNCTION public.get_embarque_full(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM embarques WHERE id = p_embarque_id) THEN NULL
    ELSE jsonb_build_object(
      'embarque', (
        SELECT to_jsonb(e.*) FROM embarques e WHERE e.id = p_embarque_id
      ),
      'conceptosVenta', COALESCE((
        SELECT jsonb_agg(to_jsonb(cv.*))
        FROM conceptos_venta cv
        WHERE cv.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'conceptosCosto', COALESCE((
        SELECT jsonb_agg(to_jsonb(cc.*))
        FROM conceptos_costo cc
        WHERE cc.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'documentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(d.*))
        FROM documentos_embarque d
        WHERE d.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'notas', COALESCE((
        SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.fecha DESC)
        FROM notas_embarque n
        WHERE n.embarque_id = p_embarque_id
      ), '[]'::jsonb),
      'facturas', COALESCE((
        SELECT jsonb_agg(to_jsonb(f.*))
        FROM facturas f
        WHERE f.embarque_id = p_embarque_id
      ), '[]'::jsonb)
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_embarque_full(uuid) TO authenticated;