-- Cotización informativa (tarifario)
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'transaccional',
  ADD COLUMN IF NOT EXISTS vigencia_desde date NULL,
  ADD COLUMN IF NOT EXISTS vigencia_hasta date NULL,
  ADD COLUMN IF NOT EXISTS tarifas_informativas jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_tipo_documento_check;
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_tipo_documento_check
  CHECK (tipo_documento IN ('transaccional','informativa'));

CREATE INDEX IF NOT EXISTS idx_cotizaciones_org_tipo_doc
  ON public.cotizaciones (organization_id, tipo_documento);

-- Trigger validador: informativa requiere vigencia y tarifas
CREATE OR REPLACE FUNCTION public.validate_cotizacion_informativa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'informativa' THEN
    IF NEW.vigencia_desde IS NULL OR NEW.vigencia_hasta IS NULL THEN
      RAISE EXCEPTION 'Cotización informativa requiere vigencia_desde y vigencia_hasta';
    END IF;
    IF NEW.vigencia_desde > NEW.vigencia_hasta THEN
      RAISE EXCEPTION 'vigencia_desde no puede ser posterior a vigencia_hasta';
    END IF;
    IF jsonb_array_length(COALESCE(NEW.tarifas_informativas, '[]'::jsonb)) < 1 THEN
      RAISE EXCEPTION 'Cotización informativa requiere al menos una tarifa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_cotizacion_informativa ON public.cotizaciones;
CREATE TRIGGER trg_validate_cotizacion_informativa
  BEFORE INSERT OR UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.validate_cotizacion_informativa();