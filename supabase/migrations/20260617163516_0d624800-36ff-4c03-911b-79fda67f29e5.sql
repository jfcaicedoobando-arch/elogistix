
ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS cerrado_at timestamptz,
  ADD COLUMN IF NOT EXISTS cerrado_por uuid,
  ADD COLUMN IF NOT EXISTS cerrado_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reabierto_at timestamptz,
  ADD COLUMN IF NOT EXISTS reabierto_por uuid,
  ADD COLUMN IF NOT EXISTS reabierto_motivo text;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.embarques'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%estatus%';
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.embarques DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cierre_embarque_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid,
  accion text NOT NULL CHECK (accion IN ('cerrar','reabrir')),
  usuario_id uuid,
  motivo text,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cierre_log_embarque ON public.cierre_embarque_log(embarque_id);
CREATE INDEX IF NOT EXISTS idx_cierre_log_org ON public.cierre_embarque_log(organization_id);

GRANT SELECT, INSERT ON public.cierre_embarque_log TO authenticated;
GRANT ALL ON public.cierre_embarque_log TO service_role;

ALTER TABLE public.cierre_embarque_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver log de cierre por organización" ON public.cierre_embarque_log;
CREATE POLICY "Ver log de cierre por organización"
ON public.cierre_embarque_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = cierre_embarque_log.organization_id
  )
  OR public.has_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "Insertar log de cierre" ON public.cierre_embarque_log;
CREATE POLICY "Insertar log de cierre"
ON public.cierre_embarque_log FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.comisiones_devengadas
  ADD COLUMN IF NOT EXISTS definitiva boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pnl_base numeric,
  ADD COLUMN IF NOT EXISTS calculo_snapshot jsonb;

INSERT INTO public.configuracion_global (categoria, clave, valor, descripcion)
VALUES
  ('cierre', 'pnl_margen_minimo_cierre', '0'::jsonb, 'Utilidad mínima en MXN requerida para cerrar un embarque'),
  ('cierre', 'cierre_admin_puede_reabrir', 'false'::jsonb, 'Si los admin (no super_admin) pueden reabrir un embarque cerrado'),
  ('cierre', 'cierre_documentos_requeridos', '["bl","factura_cliente","factura_proveedor"]'::jsonb, 'Tipos de documentos mínimos requeridos al cerrar')
ON CONFLICT (categoria, clave) DO NOTHING;
