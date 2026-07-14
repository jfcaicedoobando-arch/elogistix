DROP POLICY IF EXISTS "Hide soft deleted pagos_factura" ON public.pagos_factura;

CREATE POLICY "Hide soft deleted pagos_factura select"
ON public.pagos_factura
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Hide soft deleted pagos_factura update source"
ON public.pagos_factura
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (deleted_at IS NULL);