
CREATE TABLE public.cotizacion_plantillas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  descripcion text,
  visibilidad text NOT NULL DEFAULT 'yo' CHECK (visibilidad IN ('yo','org')),
  payload jsonb NOT NULL,
  veces_usada integer NOT NULL DEFAULT 0,
  ultima_uso_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cot_plantillas_org_uso
  ON public.cotizacion_plantillas (organization_id, veces_usada DESC, ultima_uso_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_cot_plantillas_org_user
  ON public.cotizacion_plantillas (organization_id, usuario_id)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_plantillas TO authenticated;
GRANT ALL ON public.cotizacion_plantillas TO service_role;

ALTER TABLE public.cotizacion_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver plantillas propias o compartidas de la org"
  ON public.cotizacion_plantillas FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = cotizacion_plantillas.organization_id
        AND m.user_id = auth.uid()
    )
    AND (visibilidad = 'org' OR usuario_id = auth.uid())
  );

CREATE POLICY "Crear plantillas en la propia org"
  ON public.cotizacion_plantillas FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = cotizacion_plantillas.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Editar plantillas propias o admin/gerente de la org"
  ON public.cotizacion_plantillas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = cotizacion_plantillas.organization_id
        AND m.user_id = auth.uid()
    )
    AND (
      usuario_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_org'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente_comercial'::public.app_role)
    )
  );

CREATE POLICY "Eliminar plantillas propias o admin/gerente de la org"
  ON public.cotizacion_plantillas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = cotizacion_plantillas.organization_id
        AND m.user_id = auth.uid()
    )
    AND (
      usuario_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin_org'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente_comercial'::public.app_role)
    )
  );

CREATE TRIGGER trg_cotizacion_plantillas_updated_at
  BEFORE UPDATE ON public.cotizacion_plantillas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.aplicar_plantilla_cotizacion(_plantilla_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.cotizacion_plantillas%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.cotizacion_plantillas
  WHERE id = _plantilla_id AND deleted_at IS NULL;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Plantilla no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _row.organization_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sin acceso a esta plantilla';
  END IF;

  IF _row.visibilidad = 'yo' AND _row.usuario_id <> auth.uid() THEN
    RAISE EXCEPTION 'Sin acceso a esta plantilla';
  END IF;

  UPDATE public.cotizacion_plantillas
     SET veces_usada = veces_usada + 1,
         ultima_uso_at = now()
   WHERE id = _plantilla_id;

  RETURN _row.payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_plantilla_cotizacion(uuid) TO authenticated;
