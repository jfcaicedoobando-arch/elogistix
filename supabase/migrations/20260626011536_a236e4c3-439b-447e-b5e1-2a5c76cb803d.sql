CREATE OR REPLACE FUNCTION public._assert_internal_reader(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      p_org = public.current_user_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role NOT IN ('cliente'::app_role, 'agente_carga'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;