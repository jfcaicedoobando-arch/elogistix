-- 1) bbva_movimientos: contabilidad (contador / auxiliar_contable) también captura y edita.
DROP POLICY IF EXISTS "Tesoreria write bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria write bbva_movimientos"
  ON public.bbva_movimientos FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
    )
  );

DROP POLICY IF EXISTS "Tesoreria update bbva_movimientos" ON public.bbva_movimientos;
CREATE POLICY "Tesoreria update bbva_movimientos"
  ON public.bbva_movimientos FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
    )
  )
  WITH CHECK (
    organization_id = (SELECT public.current_user_org_id())
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'tesorero'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'contador'::app_role))
    )
  );

-- 2) embarque_facturas_entrantes: sólo operaciones/admin suben al buzón del embarque.
DROP POLICY IF EXISTS "Operaciones sube facturas entrantes" ON public.embarque_facturas_entrantes;
CREATE POLICY "Operaciones sube facturas entrantes"
  ON public.embarque_facturas_entrantes FOR INSERT TO authenticated
  WITH CHECK (
    (
      organization_id = public.current_user_org_id()
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
    AND subido_por = auth.uid()
    AND estado = 'por_capturar'
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'operador'::app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    )
  );