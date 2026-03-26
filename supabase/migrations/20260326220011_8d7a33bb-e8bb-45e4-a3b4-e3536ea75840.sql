
-- Set defaults to current_user_org_id() so inserts auto-populate
ALTER TABLE public.embarques ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.clientes ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.proveedores ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.cotizaciones ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.facturas ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.conceptos_venta ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.conceptos_costo ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.conceptos_factura ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.contactos_cliente ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.cotizacion_costos ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.documentos_embarque ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.notas_embarque ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.eventos_embarque ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.configuracion ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
ALTER TABLE public.bitacora_actividad ALTER COLUMN organization_id SET DEFAULT current_user_org_id();
