
CREATE TABLE public.navieras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.navieras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer navieras" ON public.navieras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin CRUD navieras" ON public.navieras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins CRUD navieras" ON public.navieras FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.tipos_contenedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_contenedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden leer tipos_contenedor" ON public.tipos_contenedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin CRUD tipos_contenedor" ON public.tipos_contenedor FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins CRUD tipos_contenedor" ON public.tipos_contenedor FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
