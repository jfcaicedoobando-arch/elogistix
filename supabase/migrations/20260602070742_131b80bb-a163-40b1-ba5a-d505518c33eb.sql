
-- =====================================================
-- Sprint 1 — Cuentas por Cobrar (CxC)
-- =====================================================

-- 1) Enum para estado de nota de crédito
DO $$ BEGIN
  CREATE TYPE public.estado_nota_credito AS ENUM ('Borrador','Aprobada','Aplicada','Cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.motivo_nota_credito AS ENUM ('Descuento','Error','Devolucion','Bonificacion','Otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- 2) factura_series — series por organización
-- =====================================================
CREATE TABLE IF NOT EXISTS public.factura_series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  prefijo TEXT NOT NULL DEFAULT '',
  folio_actual BIGINT NOT NULL DEFAULT 0,
  folio_inicial BIGINT NOT NULL DEFAULT 1,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  es_default BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT factura_series_codigo_unique UNIQUE (organization_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_factura_series_org ON public.factura_series(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_factura_series_default
  ON public.factura_series(organization_id) WHERE es_default = TRUE;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_series TO authenticated;
GRANT ALL ON public.factura_series TO service_role;

ALTER TABLE public.factura_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read factura_series"
  ON public.factura_series FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant manage factura_series"
  ON public.factura_series FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE TRIGGER update_factura_series_updated_at
  BEFORE UPDATE ON public.factura_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3) Backfill: una serie default 'A' por organización existente
-- =====================================================
INSERT INTO public.factura_series (organization_id, codigo, prefijo, folio_actual, folio_inicial, es_default, descripcion)
SELECT o.id, 'A', 'A-', 0, 1, TRUE, 'Serie por defecto'
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.factura_series fs WHERE fs.organization_id = o.id
);

-- =====================================================
-- 4) Campos fiscales y de control en facturas (todos nullable)
-- =====================================================
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS serie_id UUID REFERENCES public.factura_series(id),
  ADD COLUMN IF NOT EXISTS folio_fiscal BIGINT,
  ADD COLUMN IF NOT EXISTS rfc_cliente TEXT,
  ADD COLUMN IF NOT EXISTS uso_cfdi TEXT,
  ADD COLUMN IF NOT EXISTS forma_pago TEXT,
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
  ADD COLUMN IF NOT EXISTS uuid_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS dias_credito INTEGER;

CREATE INDEX IF NOT EXISTS idx_facturas_serie ON public.facturas(serie_id);

-- =====================================================
-- 5) Diferencia cambiaria en pagos_factura
-- =====================================================
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS diferencia_cambiaria_mxn NUMERIC NOT NULL DEFAULT 0;

-- =====================================================
-- 6) factura_notas_credito — notas internas (pre-CFDI)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.factura_notas_credito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  folio TEXT NOT NULL,
  motivo public.motivo_nota_credito NOT NULL DEFAULT 'Otro',
  descripcion TEXT NOT NULL DEFAULT '',
  monto NUMERIC NOT NULL CHECK (monto > 0),
  moneda public.moneda NOT NULL DEFAULT 'MXN',
  tipo_cambio NUMERIC NOT NULL DEFAULT 1 CHECK (tipo_cambio > 0),
  estado public.estado_nota_credito NOT NULL DEFAULT 'Borrador',
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  aprobada_por UUID,
  aprobada_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  CONSTRAINT factura_notas_credito_folio_unique UNIQUE (organization_id, folio)
);

CREATE INDEX IF NOT EXISTS idx_factura_notas_credito_factura
  ON public.factura_notas_credito(factura_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_factura_notas_credito_org_estado
  ON public.factura_notas_credito(organization_id, estado) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_notas_credito TO authenticated;
GRANT ALL ON public.factura_notas_credito TO service_role;

ALTER TABLE public.factura_notas_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted factura_notas_credito"
  ON public.factura_notas_credito AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (TRUE);

CREATE POLICY "Tenant read factura_notas_credito"
  ON public.factura_notas_credito FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant manage factura_notas_credito"
  ON public.factura_notas_credito FOR ALL TO authenticated
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "Cliente read own factura_notas_credito"
  ON public.factura_notas_credito FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND factura_id IN (
      SELECT f.id FROM public.facturas f
      WHERE f.cliente_id IN (SELECT current_user_client_ids())
    )
  );

CREATE TRIGGER update_factura_notas_credito_updated_at
  BEFORE UPDATE ON public.factura_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7) RPC para reservar folio atómicamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.reservar_folio_factura(_serie_id UUID)
RETURNS TABLE (folio BIGINT, numero TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.factura_series%ROWTYPE;
  _next BIGINT;
BEGIN
  SELECT * INTO _row FROM public.factura_series
   WHERE id = _serie_id
     AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role))
     AND activa = TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serie no encontrada o inactiva';
  END IF;

  _next := GREATEST(_row.folio_actual + 1, _row.folio_inicial);

  UPDATE public.factura_series
     SET folio_actual = _next,
         updated_at = now()
   WHERE id = _serie_id;

  folio := _next;
  numero := _row.prefijo || _next::TEXT;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reservar_folio_factura(UUID) TO authenticated;
