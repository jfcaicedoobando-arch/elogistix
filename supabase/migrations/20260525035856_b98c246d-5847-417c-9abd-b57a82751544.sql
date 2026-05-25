
-- 1) valor_real en oportunidades
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS valor_real numeric;

-- 2) Comentarios de oportunidad
CREATE TABLE IF NOT EXISTS public.crm_comentarios_oportunidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  oportunidad_id uuid NOT NULL,
  autor_id uuid NOT NULL,
  autor_email text NOT NULL DEFAULT '',
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_crm_comentarios_oportunidad_op
  ON public.crm_comentarios_oportunidad(oportunidad_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.crm_comentarios_oportunidad ENABLE ROW LEVEL SECURITY;

-- Ocultar soft-deleted
CREATE POLICY "Hide soft deleted crm_comentarios_oportunidad"
  ON public.crm_comentarios_oportunidad
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

-- Tenant read (staff + viewer + vendedor dueño de la oportunidad)
CREATE POLICY "Tenant read crm_comentarios_oportunidad"
  ON public.crm_comentarios_oportunidad
  FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id())
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Staff write (admin / operador)
CREATE POLICY "Staff write crm_comentarios_oportunidad"
  ON public.crm_comentarios_oportunidad
  FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = current_user_org_id())
    AND autor_id = auth.uid()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        has_role(auth.uid(), 'vendedor'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.crm_oportunidades o
          WHERE o.id = oportunidad_id
            AND o.vendedor_id = auth.uid()
            AND o.organization_id = current_user_org_id()
        )
      )
    )
  );

CREATE POLICY "Author update crm_comentarios_oportunidad"
  ON public.crm_comentarios_oportunidad
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid() AND organization_id = current_user_org_id())
  WITH CHECK (autor_id = auth.uid() AND organization_id = current_user_org_id());

-- 3) Trigger: cuando cotización ligada a oportunidad pasa a Aceptada,
--    registra valor_real con el subtotal final.
CREATE OR REPLACE FUNCTION public.crm_set_valor_real_on_aceptada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.oportunidad_id IS NOT NULL
     AND NEW.estado = 'Aceptada'::estado_cotizacion
     AND (OLD.estado IS DISTINCT FROM NEW.estado) THEN
    UPDATE public.crm_oportunidades
       SET valor_real = COALESCE(valor_real, NEW.subtotal),
           fecha_cierre_real = COALESCE(fecha_cierre_real, CURRENT_DATE),
           updated_at = now()
     WHERE id = NEW.oportunidad_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_set_valor_real_on_aceptada ON public.cotizaciones;
CREATE TRIGGER trg_crm_set_valor_real_on_aceptada
  AFTER UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_set_valor_real_on_aceptada();

-- 4) Trigger: notifica al vendedor cuando alguien más comenta su oportunidad
CREATE OR REPLACE FUNCTION public.crm_notify_comentario_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendedor_id uuid;
  v_op_nombre text;
BEGIN
  SELECT vendedor_id, nombre
    INTO v_vendedor_id, v_op_nombre
    FROM public.crm_oportunidades
   WHERE id = NEW.oportunidad_id;

  IF v_vendedor_id IS NOT NULL AND v_vendedor_id <> NEW.autor_id THEN
    INSERT INTO public.crm_notificaciones (
      organization_id, user_id, tipo, titulo, mensaje, link
    ) VALUES (
      NEW.organization_id,
      v_vendedor_id,
      'comentario_oportunidad',
      'Nuevo comentario en oportunidad',
      COALESCE(NEW.autor_email, 'Alguien') || ' comentó en "' || COALESCE(v_op_nombre, 'oportunidad') || '"',
      '/crm/oportunidades/' || NEW.oportunidad_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_notify_comentario_oportunidad ON public.crm_comentarios_oportunidad;
CREATE TRIGGER trg_crm_notify_comentario_oportunidad
  AFTER INSERT ON public.crm_comentarios_oportunidad
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_notify_comentario_oportunidad();
