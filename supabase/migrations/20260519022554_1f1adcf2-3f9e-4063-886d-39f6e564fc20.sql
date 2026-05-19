
-- Enums
CREATE TYPE public.tipo_reporte_feedback AS ENUM ('bug', 'mejora');
CREATE TYPE public.estado_reporte_feedback AS ENUM ('nuevo', 'en_revision', 'resuelto', 'descartado');

-- Tabla principal
CREATE TABLE public.reportes_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_reporte_feedback NOT NULL,
  estado public.estado_reporte_feedback NOT NULL DEFAULT 'nuevo',
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  url TEXT,
  elemento_selector TEXT,
  elemento_texto TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  imagenes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  usuario_id UUID NOT NULL,
  usuario_email TEXT NOT NULL DEFAULT '',
  organization_id UUID,
  rol_reportero TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reportes_feedback_titulo_len CHECK (char_length(titulo) BETWEEN 5 AND 200),
  CONSTRAINT reportes_feedback_descripcion_len CHECK (char_length(descripcion) BETWEEN 10 AND 4000),
  CONSTRAINT reportes_feedback_imagenes_max CHECK (array_length(imagenes, 1) IS NULL OR array_length(imagenes, 1) <= 3)
);

CREATE INDEX idx_reportes_feedback_usuario ON public.reportes_feedback(usuario_id, created_at DESC);
CREATE INDEX idx_reportes_feedback_estado ON public.reportes_feedback(estado, created_at DESC);
CREATE INDEX idx_reportes_feedback_tipo ON public.reportes_feedback(tipo);
CREATE INDEX idx_reportes_feedback_org ON public.reportes_feedback(organization_id);

ALTER TABLE public.reportes_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios crean sus reportes"
  ON public.reportes_feedback FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuarios leen sus reportes"
  ON public.reportes_feedback FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin actualiza reportes"
  ON public.reportes_feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin borra reportes"
  ON public.reportes_feedback FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Tabla de comentarios
CREATE TABLE public.reportes_feedback_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id UUID NOT NULL REFERENCES public.reportes_feedback(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  autor_email TEXT NOT NULL DEFAULT '',
  autor_es_admin BOOLEAN NOT NULL DEFAULT false,
  contenido TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comentarios_feedback_len CHECK (char_length(contenido) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_reportes_feedback_comentarios_reporte ON public.reportes_feedback_comentarios(reporte_id, created_at);

ALTER TABLE public.reportes_feedback_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura comentarios feedback"
  ON public.reportes_feedback_comentarios FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.reportes_feedback r
      WHERE r.id = reporte_id AND r.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Inserción comentarios feedback"
  ON public.reportes_feedback_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid() AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.reportes_feedback r
        WHERE r.id = reporte_id AND r.usuario_id = auth.uid()
      )
    )
  );

-- Trigger updated_at
CREATE TRIGGER trg_reportes_feedback_updated_at
  BEFORE UPDATE ON public.reportes_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('reportes-feedback', 'reportes-feedback', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: el path es {usuario_id}/{reporte_id}/{file}
CREATE POLICY "Usuario sube sus imágenes feedback"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reportes-feedback'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Usuario lee sus imágenes feedback"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reportes-feedback'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Usuario borra sus imágenes feedback"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reportes-feedback'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );
