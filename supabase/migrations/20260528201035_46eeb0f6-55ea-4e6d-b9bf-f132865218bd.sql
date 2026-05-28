
-- =====================================================
-- Fase A: Tabla hija embarque_contenedores
-- =====================================================

CREATE TABLE public.embarque_contenedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  numero_contenedor text NOT NULL DEFAULT '',
  tipo_contenedor text NOT NULL DEFAULT '',
  bl_house text NOT NULL DEFAULT '',
  peso_kg numeric NOT NULL DEFAULT 0,
  volumen_m3 numeric NOT NULL DEFAULT 0,
  piezas integer NOT NULL DEFAULT 0,
  orden integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL
);

CREATE INDEX idx_embarque_contenedores_embarque_id
  ON public.embarque_contenedores(embarque_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_embarque_contenedores_org
  ON public.embarque_contenedores(organization_id) WHERE deleted_at IS NULL;

-- GRANTs (espejo de embarques)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.embarque_contenedores TO authenticated;
GRANT ALL ON public.embarque_contenedores TO service_role;

ALTER TABLE public.embarque_contenedores ENABLE ROW LEVEL SECURITY;

-- Soft-delete filter
CREATE POLICY "Hide soft deleted embarque_contenedores"
  ON public.embarque_contenedores
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

-- Tenant staff CRUD
CREATE POLICY "Tenant CRUD embarque_contenedores"
  ON public.embarque_contenedores
  FOR ALL
  TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

-- Tenant viewer read
CREATE POLICY "Tenant viewer embarque_contenedores"
  ON public.embarque_contenedores
  FOR SELECT
  TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role)
  );

-- Cliente lee contenedores de sus propios embarques
CREATE POLICY "Cliente read own embarque_contenedores"
  ON public.embarque_contenedores
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND embarque_id IN (
      SELECT e.id FROM public.embarques e
      WHERE e.cliente_id IN (SELECT current_user_client_ids())
    )
  );

-- Trigger: mantener updated_at
CREATE TRIGGER trg_embarque_contenedores_updated_at
  BEFORE UPDATE ON public.embarque_contenedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Conceptos: contenedor_id opcional
-- =====================================================

ALTER TABLE public.conceptos_venta
  ADD COLUMN contenedor_id uuid NULL REFERENCES public.embarque_contenedores(id) ON DELETE SET NULL;

ALTER TABLE public.conceptos_costo
  ADD COLUMN contenedor_id uuid NULL REFERENCES public.embarque_contenedores(id) ON DELETE SET NULL;

CREATE INDEX idx_conceptos_venta_contenedor ON public.conceptos_venta(contenedor_id) WHERE contenedor_id IS NOT NULL;
CREATE INDEX idx_conceptos_costo_contenedor ON public.conceptos_costo(contenedor_id) WHERE contenedor_id IS NOT NULL;

-- =====================================================
-- Migración de datos: embarques existentes → 1 contenedor cada uno
-- =====================================================

INSERT INTO public.embarque_contenedores
  (embarque_id, organization_id, numero_contenedor, tipo_contenedor, bl_house, peso_kg, volumen_m3, piezas, orden, created_at, updated_at)
SELECT
  e.id,
  e.organization_id,
  COALESCE(e.contenedor, ''),
  COALESCE(e.tipo_contenedor, ''),
  COALESCE(e.bl_house, ''),
  COALESCE(e.peso_kg, 0),
  COALESCE(e.volumen_m3, 0),
  COALESCE(e.piezas, 0),
  1,
  COALESCE(e.created_at, now()),
  now()
FROM public.embarques e
WHERE e.deleted_at IS NULL
  AND (
    COALESCE(e.contenedor, '') <> ''
    OR COALESCE(e.tipo_contenedor, '') <> ''
    OR COALESCE(e.peso_kg, 0) > 0
    OR COALESCE(e.volumen_m3, 0) > 0
    OR COALESCE(e.piezas, 0) > 0
  );

-- =====================================================
-- Trigger de sincronización (compat hacia atrás):
-- el primer contenedor del embarque (orden ASC) refleja
-- sus valores en embarques.contenedor / tipo_contenedor / peso_kg / volumen_m3 / piezas
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_embarque_desde_contenedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embarque_id uuid;
  v_total_peso numeric;
  v_total_vol numeric;
  v_total_piezas integer;
  v_primer record;
BEGIN
  v_embarque_id := COALESCE(NEW.embarque_id, OLD.embarque_id);

  SELECT
    COALESCE(SUM(peso_kg), 0),
    COALESCE(SUM(volumen_m3), 0),
    COALESCE(SUM(piezas), 0)
  INTO v_total_peso, v_total_vol, v_total_piezas
  FROM public.embarque_contenedores
  WHERE embarque_id = v_embarque_id AND deleted_at IS NULL;

  SELECT numero_contenedor, tipo_contenedor
  INTO v_primer
  FROM public.embarque_contenedores
  WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC
  LIMIT 1;

  UPDATE public.embarques
  SET
    contenedor = COALESCE(v_primer.numero_contenedor, ''),
    tipo_contenedor = COALESCE(v_primer.tipo_contenedor, ''),
    peso_kg = v_total_peso,
    volumen_m3 = v_total_vol,
    piezas = v_total_piezas
  WHERE id = v_embarque_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_embarque_desde_contenedor
  AFTER INSERT OR UPDATE OR DELETE ON public.embarque_contenedores
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_embarque_desde_contenedor();

COMMENT ON COLUMN public.embarques.contenedor IS 'DEPRECATED: usar embarque_contenedores. Se sincroniza con el primer contenedor.';
COMMENT ON COLUMN public.embarques.tipo_contenedor IS 'DEPRECATED: usar embarque_contenedores. Se sincroniza con el primer contenedor.';
