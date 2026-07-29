-- FIX P-03: el rol tesorero/contador no podía leer el módulo de Tesorería

DROP POLICY IF EXISTS "Tesoreria read cuentas_bancarias" ON public.cuentas_bancarias;
CREATE POLICY "Tesoreria read cuentas_bancarias" ON public.cuentas_bancarias
FOR SELECT TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  AND (
    public.has_role((SELECT auth.uid()), 'tesorero'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Tesoreria read bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria read bbva_movimientos" ON public.bbva_movimientos
FOR SELECT TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  AND (
    public.has_role((SELECT auth.uid()), 'tesorero'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::public.app_role)
  )
);

-- El tesorero concilia: necesita insertar/actualizar movimientos bancarios de su org.
DROP POLICY IF EXISTS "Tesoreria write bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria write bbva_movimientos" ON public.bbva_movimientos
FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (SELECT public.current_user_org_id())
  AND public.has_role((SELECT auth.uid()), 'tesorero'::public.app_role)
);

DROP POLICY IF EXISTS "Tesoreria update bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria update bbva_movimientos" ON public.bbva_movimientos
FOR UPDATE TO authenticated
USING (
  organization_id = (SELECT public.current_user_org_id())
  AND public.has_role((SELECT auth.uid()), 'tesorero'::public.app_role)
)
WITH CHECK (
  organization_id = (SELECT public.current_user_org_id())
  AND public.has_role((SELECT auth.uid()), 'tesorero'::public.app_role)
);