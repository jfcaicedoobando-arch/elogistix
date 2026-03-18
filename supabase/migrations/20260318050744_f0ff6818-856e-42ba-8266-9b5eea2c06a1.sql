
-- Tipos de eventos de tracking
CREATE TYPE public.tipo_evento_tracking AS ENUM (
  'Zarpe', 'Transbordo', 'Arribo a Puerto', 'Descarga', 'Despacho Aduanal',
  'Liberación', 'En Ruta Terrestre', 'Entrega', 'Demora', 'Inspección', 'Otro'
);

-- Tabla de eventos de tracking
CREATE TABLE public.eventos_embarque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  tipo tipo_evento_tracking NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  ubicacion text NOT NULL DEFAULT '',
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  usuario text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para consultas por embarque
CREATE INDEX idx_eventos_embarque_embarque_id ON public.eventos_embarque(embarque_id);

-- RLS
ALTER TABLE public.eventos_embarque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD eventos_embarque"
  ON public.eventos_embarque FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Viewers pueden ver eventos_embarque"
  ON public.eventos_embarque FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'viewer'::app_role));
