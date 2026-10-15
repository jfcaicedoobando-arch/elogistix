ALTER TABLE public.costeo_cargos_fob_agente ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;
ALTER TABLE public.costeo_cargos_locales_naviera ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;
