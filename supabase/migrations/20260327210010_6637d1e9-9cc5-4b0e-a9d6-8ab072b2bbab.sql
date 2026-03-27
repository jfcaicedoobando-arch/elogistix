
-- Tabla configuracion_global (sin organization_id)
CREATE TABLE public.configuracion_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  clave text NOT NULL,
  valor jsonb NOT NULL DEFAULT '{}',
  descripcion text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(categoria, clave)
);

ALTER TABLE public.configuracion_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin CRUD configuracion_global"
  ON public.configuracion_global FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated read configuracion_global"
  ON public.configuracion_global FOR SELECT TO authenticated
  USING (true);

-- Tabla planes
CREATE TABLE public.planes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  max_usuarios int NOT NULL DEFAULT 5,
  max_embarques_mes int NOT NULL DEFAULT 100,
  almacenamiento_mb int NOT NULL DEFAULT 500,
  precio_mensual numeric NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin CRUD planes"
  ON public.planes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated read planes"
  ON public.planes FOR SELECT TO authenticated
  USING (true);

-- Seed default plans
INSERT INTO public.planes (nombre, max_usuarios, max_embarques_mes, almacenamiento_mb, precio_mensual)
VALUES 
  ('basic', 5, 100, 500, 0),
  ('pro', 15, 500, 2000, 999),
  ('enterprise', 100, 5000, 10000, 4999);

-- Seed default global config - plataforma
INSERT INTO public.configuracion_global (categoria, clave, valor, descripcion) VALUES
  ('plataforma', 'nombre_app', '"Elogistix"', 'Nombre de la plataforma'),
  ('plataforma', 'tagline', '"Sistema de gestión logística"', 'Subtítulo de la plataforma'),
  ('plataforma', 'logo_url', '""', 'URL del logo'),
  ('plataforma', 'color_primario', '"#1e40af"', 'Color primario de la marca'),
  ('plataforma', 'email_soporte', '"soporte@elogistix.com"', 'Email de soporte');

-- Seed default global config - seguridad
INSERT INTO public.configuracion_global (categoria, clave, valor, descripcion) VALUES
  ('seguridad', 'auto_confirmar_email', 'false', 'Auto-confirmar emails al registrar'),
  ('seguridad', 'longitud_minima_password', '8', 'Longitud mínima de contraseña'),
  ('seguridad', 'expiracion_sesion_horas', '24', 'Tiempo de expiración de sesión en horas'),
  ('seguridad', 'max_intentos_login', '5', 'Intentos máximos de login antes de bloqueo'),
  ('seguridad', 'permitir_registro_publico', 'false', 'Permitir registro público de usuarios');

-- Super admin RLS on puertos table
CREATE POLICY "Super admin CRUD puertos"
  ON public.puertos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
