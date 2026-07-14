DROP POLICY IF EXISTS "Hide soft deleted pagos_factura update source" ON public.pagos_factura;

CREATE POLICY "Hide soft deleted pagos_factura update source"
ON public.pagos_factura
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (deleted_at IS NULL)
WITH CHECK ((organization_id = public.current_user_org_id()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));