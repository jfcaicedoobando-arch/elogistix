CREATE OR REPLACE FUNCTION public.set_margen_minimo_utilidad(p_pct numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.org_scope();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Sin organización activa' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'gerente_comercial'::app_role)) THEN
    RAISE EXCEPTION 'Sólo administración o gerencia comercial puede cambiar el margen mínimo' USING ERRCODE = '42501';
  END IF;
  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RAISE EXCEPTION 'El margen mínimo debe estar entre 0 y 100' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
  VALUES (v_org, 'comercial', 'margen_minimo_utilidad_pct', to_jsonb(p_pct),
          'Margen mínimo de utilidad estimada (%) antes de requerir autorización')
  ON CONFLICT (organization_id, categoria, clave) DO UPDATE SET valor = EXCLUDED.valor;
  RETURN p_pct;
END;
$$;
REVOKE ALL ON FUNCTION public.set_margen_minimo_utilidad(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_margen_minimo_utilidad(numeric) TO authenticated;