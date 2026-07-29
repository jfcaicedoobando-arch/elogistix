CREATE OR REPLACE FUNCTION public.tc_dof_upsert_manual(
  _fecha date,
  _usd numeric,
  _eur numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'admin_org'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'contador'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_TC_DOF_FORBIDDEN: sin permisos para registrar tipo de cambio';
  END IF;

  IF _usd IS NULL OR _usd <= 0 THEN
    RAISE EXCEPTION 'LC_TC_DOF_INVALIDO: el tipo de cambio USD debe ser mayor a cero';
  END IF;

  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, eur_mxn, fuente, origen)
  VALUES (_fecha, _usd, NULLIF(_eur, 0), 'banxico_sie', 'manual')
  ON CONFLICT (fecha) DO UPDATE
    SET usd_mxn = EXCLUDED.usd_mxn,
        eur_mxn = COALESCE(EXCLUDED.eur_mxn, public.tipos_cambio_dof.eur_mxn),
        origen  = 'manual',
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.tc_dof_upsert_manual(date, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tc_dof_upsert_manual(date, numeric, numeric) TO authenticated, service_role;