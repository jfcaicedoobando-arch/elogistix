-- 13.141.6 — Habilita rol `contador` en helper _assert_writer (operaciones contables/fiscales)
CREATE OR REPLACE FUNCTION public._assert_writer(p_org uuid)
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
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'contador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$$;

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
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'contador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;