
-- Add organization_id to all 14 data tables
-- Using default value for existing data pointing to Elogistix org

ALTER TABLE public.embarques ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.clientes ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.proveedores ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.cotizaciones ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.facturas ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.conceptos_venta ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.conceptos_costo ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.conceptos_factura ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.contactos_cliente ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.cotizacion_costos ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.documentos_embarque ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.notas_embarque ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.eventos_embarque ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.configuracion ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.bitacora_actividad ADD COLUMN organization_id uuid REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Set existing rows to default org
UPDATE public.embarques SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.clientes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.proveedores SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.cotizaciones SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.facturas SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.conceptos_venta SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.conceptos_costo SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.conceptos_factura SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.contactos_cliente SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.cotizacion_costos SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.documentos_embarque SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.notas_embarque SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.eventos_embarque SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.configuracion SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.bitacora_actividad SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Now make NOT NULL
ALTER TABLE public.embarques ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.proveedores ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cotizaciones ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.facturas ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conceptos_venta ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conceptos_costo ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.conceptos_factura ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contactos_cliente ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cotizacion_costos ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.documentos_embarque ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notas_embarque ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.eventos_embarque ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.configuracion ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.bitacora_actividad ALTER COLUMN organization_id SET NOT NULL;
