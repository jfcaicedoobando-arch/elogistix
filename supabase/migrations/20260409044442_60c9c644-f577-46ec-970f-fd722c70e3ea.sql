CREATE POLICY "Cliente read own clientes"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND id IN (SELECT current_user_client_ids())
);