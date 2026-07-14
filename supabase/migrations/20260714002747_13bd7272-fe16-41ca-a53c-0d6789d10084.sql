DROP POLICY IF EXISTS "Hide soft deleted pagos_factura update source" ON public.pagos_factura;

CREATE POLICY "Hide soft deleted pagos_factura update source"
ON public.pagos_factura
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (deleted_at IS NULL)
WITH CHECK (true);