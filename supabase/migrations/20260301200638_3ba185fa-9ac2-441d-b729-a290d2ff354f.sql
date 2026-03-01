
-- Tabla centralizada de bitácora de actividad
CREATE TABLE public.bitacora_actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  usuario_email text NOT NULL DEFAULT '',
  accion text NOT NULL,
  modulo text NOT NULL,
  entidad_id uuid,
  entidad_nombre text DEFAULT '',
  detalles jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_bitacora_usuario ON public.bitacora_actividad(usuario_id);
CREATE INDEX idx_bitacora_modulo ON public.bitacora_actividad(modulo);
CREATE INDEX idx_bitacora_created_at ON public.bitacora_actividad(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.bitacora_actividad ENABLE ROW LEVEL SECURITY;

-- Admin ve toda la bitácora
CREATE POLICY "Admins ven toda la bitacora"
ON public.bitacora_actividad
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Operadores y viewers ven solo sus propias acciones
CREATE POLICY "Usuarios ven sus propias acciones"
ON public.bitacora_actividad
FOR SELECT
TO authenticated
USING (usuario_id = auth.uid());

-- Todos los autenticados pueden insertar (registrar acciones)
CREATE POLICY "Autenticados pueden insertar bitacora"
ON public.bitacora_actividad
FOR INSERT
TO authenticated
WITH CHECK (usuario_id = auth.uid());
