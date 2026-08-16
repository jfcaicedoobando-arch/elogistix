ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS sitio_web text,
  ADD COLUMN IF NOT EXISTS anios_establecida integer,
  ADD COLUMN IF NOT EXISTS mercancia text,
  ADD COLUMN IF NOT EXISTS rutas text,
  ADD COLUMN IF NOT EXISTS aduana_puerto text,
  ADD COLUMN IF NOT EXISTS incoterm text,
  ADD COLUMN IF NOT EXISTS volumen text,
  ADD COLUMN IF NOT EXISTS frecuencia text,
  ADD COLUMN IF NOT EXISTS dolor_explicito text,
  ADD COLUMN IF NOT EXISTS consecuencia text,
  ADD COLUMN IF NOT EXISTS proveedor_actual text,
  ADD COLUMN IF NOT EXISTS estatus_icp text,
  ADD COLUMN IF NOT EXISTS motivo_nutricion text,
  ADD COLUMN IF NOT EXISTS fecha_nutricion date;

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS mercancia text,
  ADD COLUMN IF NOT EXISTS rutas text,
  ADD COLUMN IF NOT EXISTS aduana_puerto text,
  ADD COLUMN IF NOT EXISTS incoterm text,
  ADD COLUMN IF NOT EXISTS volumen text,
  ADD COLUMN IF NOT EXISTS frecuencia text,
  ADD COLUMN IF NOT EXISTS dolor_explicito text,
  ADD COLUMN IF NOT EXISTS proveedor_actual text;

COMMENT ON COLUMN public.crm_leads.estatus_icp IS 'Etapa 1 CRM Hunter: clasificación del prospecto frente al perfil de cliente ideal (ICP).';
COMMENT ON COLUMN public.crm_oportunidades.mercancia IS 'Etapa 1 CRM Hunter: heredado del perfil ICP del prospecto.';