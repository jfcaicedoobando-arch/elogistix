
-- Create client_users table
CREATE TABLE public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cliente_id)
);

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff manage client_users" ON public.client_users
FOR ALL TO authenticated
USING (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Client read own client_users" ON public.client_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Function to get current user's client IDs
CREATE OR REPLACE FUNCTION public.current_user_client_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cliente_id FROM public.client_users WHERE user_id = auth.uid();
$$;

-- RLS for cliente role on embarques
CREATE POLICY "Cliente read own embarques" ON public.embarques
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  cliente_id IN (SELECT current_user_client_ids())
);

-- RLS for cliente role on documentos_embarque
CREATE POLICY "Cliente read own documentos" ON public.documentos_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

-- RLS for cliente role on eventos_embarque
CREATE POLICY "Cliente read own eventos" ON public.eventos_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

-- RLS for cliente role on cotizaciones
CREATE POLICY "Cliente read own cotizaciones" ON public.cotizaciones
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  cliente_id IN (SELECT current_user_client_ids())
);

-- RLS for cliente role on facturas
CREATE POLICY "Cliente read own facturas" ON public.facturas
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  cliente_id IN (SELECT current_user_client_ids())
);

-- RLS for cliente role on conceptos_venta
CREATE POLICY "Cliente read own conceptos_venta" ON public.conceptos_venta
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

-- RLS for cliente role on notas_embarque (only nota and cambio_estado types)
CREATE POLICY "Cliente read own notas" ON public.notas_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  tipo IN ('nota'::tipo_nota, 'cambio_estado'::tipo_nota) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

-- Create tracking_links table
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org staff manage tracking_links" ON public.tracking_links
FOR ALL TO authenticated
USING (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);
