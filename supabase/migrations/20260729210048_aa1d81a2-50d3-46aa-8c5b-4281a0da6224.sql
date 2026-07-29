-- Tesorero: administración completa de cuentas bancarias de su organización.
-- Contador conserva sólo lectura (política "Tesoreria read cuentas_bancarias").
DROP POLICY IF EXISTS "Tesoreria manage cuentas_bancarias" ON public.cuentas_bancarias;

CREATE POLICY "Tesoreria manage cuentas_bancarias"
ON public.cuentas_bancarias
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  AND public.has_role((SELECT auth.uid()), 'tesorero'::app_role)
)
WITH CHECK (
  organization_id = (SELECT public.current_user_org_id())
  AND public.has_role((SELECT auth.uid()), 'tesorero'::app_role)
);