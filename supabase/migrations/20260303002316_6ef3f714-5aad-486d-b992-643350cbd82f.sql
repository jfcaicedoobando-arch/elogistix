
-- Table for centralized configuration (key-value with categories)
CREATE TABLE public.configuracion (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria text NOT NULL,
  clave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  descripcion text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (categoria, clave)
);

-- Enable RLS
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read config
CREATE POLICY "Autenticados pueden leer configuracion"
ON public.configuracion
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify config
CREATE POLICY "Admins pueden modificar configuracion"
ON public.configuracion
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_configuracion_updated_at
BEFORE UPDATE ON public.configuracion
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
