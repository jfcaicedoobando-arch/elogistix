ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'general';
UPDATE public.clientes SET tipo_cliente = 'especial' WHERE id IN ('87bdcbf1-4476-43f5-a6a2-ac4991658f6e','8cdb3331-9e1e-4a1f-937e-bdac8894121a');
ALTER TABLE public.clientes ADD CONSTRAINT clientes_tipo_cliente_chk CHECK (tipo_cliente IN ('general','especial'));
COMMENT ON COLUMN public.clientes.tipo_cliente IS 'Clasificación comercial: general | especial. Sólo informativa.';