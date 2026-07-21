DROP POLICY IF EXISTS "Hide soft deleted proveedor_facturas" ON public.proveedor_facturas;
CREATE POLICY "Hide soft deleted proveedor_facturas"
ON public.proveedor_facturas
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (deleted_at IS NULL);