CREATE OR REPLACE FUNCTION public.seed_presupuesto_categorias(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing INTEGER;
  v_org uuid;
BEGIN
  -- v13.782.1 — `pg_has_role(current_user,'service_role','MEMBER')` cubre los
  -- callers de mantenimiento (postgres/superuser, replay de migraciones y las
  -- suites RLS del CI). `authenticated` NO es miembro de service_role, así que
  -- el candado multi-tenant para la app queda intacto.
  IF public.has_role(auth.uid(), 'super_admin'::app_role)
     OR COALESCE(auth.role()::text, '') = 'service_role'
     OR pg_has_role(current_user, 'service_role', 'MEMBER') THEN
    v_org := p_organization_id;
  ELSE
    v_org := public.current_user_org_id();
    IF v_org IS NULL OR p_organization_id IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes sembrar categorías de otra organización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.presupuesto_categorias
  WHERE organization_id = v_org;
  IF v_existing > 0 THEN RETURN; END IF;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, tipo_contable, orden, activa) VALUES
    (v_org, 'Costos directos de embarque (COGS)', 'CostoDirectoEmbarque', 10, true),
    (v_org, 'Gastos de administración',           'Administracion',        20, true),
    (v_org, 'Gastos de venta',                    'Venta',                 30, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_presupuesto_categorias(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_presupuesto_categorias(uuid) TO authenticated, service_role;