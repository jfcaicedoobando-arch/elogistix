CREATE OR REPLACE FUNCTION public.get_agente_rutas_v2()
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  puerto_origen_id uuid,
  puerto_destino_id uuid,
  activa boolean,
  puerto_origen_nombre text,
  puerto_destino_nombre text,
  puerto_origen_code text,
  puerto_origen_country text,
  puerto_destino_code text,
  puerto_destino_country text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.organization_id, r.puerto_origen_id, r.puerto_destino_id, r.activa,
         po.name AS puerto_origen_nombre,
         pd.name AS puerto_destino_nombre,
         po.code AS puerto_origen_code,
         po.country AS puerto_origen_country,
         pd.code AS puerto_destino_code,
         pd.country AS puerto_destino_country
    FROM public.costeo_rutas r
    JOIN public.agente_users au ON au.user_id = auth.uid()
    JOIN public.costeo_agentes a ON a.id = au.agente_id
                                 AND a.organization_id = r.organization_id
    LEFT JOIN public.puertos po ON po.id = r.puerto_origen_id
    LEFT JOIN public.puertos pd ON pd.id = r.puerto_destino_id
   WHERE r.activa = true;
$$;

REVOKE ALL ON FUNCTION public.get_agente_rutas_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agente_rutas_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agente_rutas_v2() TO service_role;