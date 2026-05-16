
-- 1) Guard org en generar_numero_proforma
CREATE OR REPLACE FUNCTION public.generar_numero_proforma(p_org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_prefix text := 'PRO-' || v_year::text || '-';
  v_next int;
BEGIN
  IF p_org_id IS NULL
     OR (p_org_id <> current_user_org_id()
         AND NOT has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden: organization mismatch';
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(numero, '^PRO-\d{4}-', ''), '')::int
  ), 0) + 1
  INTO v_next
  FROM public.proformas
  WHERE organization_id = p_org_id
    AND numero LIKE v_prefix || '%';

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$function$;

-- 2) Restringir SELECT de auditoria_comentarios a staff
DROP POLICY IF EXISTS "Tenant read auditoria_comentarios" ON public.auditoria_comentarios;

CREATE POLICY "Staff read auditoria_comentarios"
ON public.auditoria_comentarios FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    organization_id = current_user_org_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
    )
  )
);

-- 3) Restringir SELECT de auditoria_revisiones a staff
DROP POLICY IF EXISTS "Tenant read auditoria_revisiones" ON public.auditoria_revisiones;

CREATE POLICY "Staff read auditoria_revisiones"
ON public.auditoria_revisiones FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    organization_id = current_user_org_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
    )
  )
);
