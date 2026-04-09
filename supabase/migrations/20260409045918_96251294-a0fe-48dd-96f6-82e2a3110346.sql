CREATE POLICY "Client read own org"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND id IN (
    SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
  )
);