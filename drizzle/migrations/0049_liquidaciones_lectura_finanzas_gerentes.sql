-- Lectura (sólo SELECT) de liquidaciones para finanzas y gerencias; la escritura sigue sólo por RPC.
DROP POLICY IF EXISTS liq_finanzas_read ON public.liquidaciones_comision;
CREATE POLICY liq_finanzas_read ON public.liquidaciones_comision
  FOR SELECT TO authenticated
  USING (
    public.has_any_role_in_org(
      (SELECT auth.uid()),
      ARRAY['admin','admin_org','contador','tesorero','gerente_comercial','gerente_operaciones','gerente_visor']::public.app_role[],
      organization_id
    )
  );