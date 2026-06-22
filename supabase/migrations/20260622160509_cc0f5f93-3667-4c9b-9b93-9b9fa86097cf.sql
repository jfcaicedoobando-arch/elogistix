CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        CASE _role
          WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
          WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
          WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
          WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','ejecutivo_pricing','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
          WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','auxiliar_contable','ejecutivo_cobranza','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
          WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
          WHEN 'contador'::app_role THEN ARRAY['contador','auxiliar_contable','admin_org','super_admin']::app_role[]
          WHEN 'tesorero'::app_role THEN ARRAY['tesorero','admin_org','super_admin']::app_role[]
          WHEN 'auxiliar_contable'::app_role THEN ARRAY['auxiliar_contable','contador','admin_org','super_admin']::app_role[]
          WHEN 'ejecutivo_cobranza'::app_role THEN ARRAY['ejecutivo_cobranza','contador','admin_org','super_admin']::app_role[]
          ELSE ARRAY[_role]::app_role[]
        END
      )
  )
$function$;