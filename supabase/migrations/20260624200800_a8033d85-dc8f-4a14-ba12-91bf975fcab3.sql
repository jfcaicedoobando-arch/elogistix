CREATE OR REPLACE FUNCTION public.get_agente_rutas()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  puerto_origen_id uuid,
  puerto_destino_id uuid,
  activa boolean,
  puerto_origen_nombre text,
  puerto_destino_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.organization_id, r.puerto_origen_id, r.puerto_destino_id, r.activa,
         po.name AS puerto_origen_nombre,
         pd.name AS puerto_destino_nombre
    FROM public.costeo_rutas r
    JOIN public.agente_users au ON au.user_id = auth.uid()
    JOIN public.costeo_agentes a ON a.id = au.agente_id
                                 AND a.organization_id = r.organization_id
    LEFT JOIN public.puertos po ON po.id = r.puerto_origen_id
    LEFT JOIN public.puertos pd ON pd.id = r.puerto_destino_id
   WHERE r.activa = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_agente_rutas() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_agente_rutas() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_agente_rutas() TO authenticated;