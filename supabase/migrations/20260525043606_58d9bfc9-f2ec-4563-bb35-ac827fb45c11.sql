ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_etapa_id_fkey
  FOREIGN KEY (etapa_id) REFERENCES public.crm_etapas_pipeline(id) ON DELETE RESTRICT;

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.crm_leads(id) ON DELETE SET NULL;

ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_motivo_perdida_id_fkey
  FOREIGN KEY (motivo_perdida_id) REFERENCES public.crm_motivos_perdida(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_etapa_id ON public.crm_oportunidades(etapa_id);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_cliente_id ON public.crm_oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_oportunidades_lead_id ON public.crm_oportunidades(lead_id);