
-- Extender catalogo_claves_sat a catálogo de productos/servicios
ALTER TABLE public.catalogo_claves_sat
  ADD COLUMN IF NOT EXISTS tipo_iva text NOT NULL DEFAULT 'gravado_16',
  ADD COLUMN IF NOT EXISTS tasa_iva_default numeric,
  ADD COLUMN IF NOT EXISTS clave_unidad_sat text NOT NULL DEFAULT 'E48',
  ADD COLUMN IF NOT EXISTS nombre_unidad text;

-- CHECK para tipo_iva
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'catalogo_claves_sat_tipo_iva_chk'
      AND conrelid = 'public.catalogo_claves_sat'::regclass
  ) THEN
    ALTER TABLE public.catalogo_claves_sat
      ADD CONSTRAINT catalogo_claves_sat_tipo_iva_chk
      CHECK (tipo_iva IN ('gravado_16', 'tasa_0', 'exento'));
  END IF;
END $$;

-- Backfill tasa_iva_default a partir de tipo_iva
UPDATE public.catalogo_claves_sat
SET tasa_iva_default = CASE tipo_iva
  WHEN 'gravado_16' THEN 0.16
  WHEN 'tasa_0' THEN 0
  WHEN 'exento' THEN NULL
END
WHERE tasa_iva_default IS NULL OR tasa_iva_default <> CASE tipo_iva
  WHEN 'gravado_16' THEN 0.16
  WHEN 'tasa_0' THEN 0
  WHEN 'exento' THEN NULL
END;

-- Resolver por nombre exacto (para cotizaciones que eligen del catálogo)
CREATE OR REPLACE FUNCTION public.resolver_producto_sat(p_org uuid, p_nombre text)
RETURNS TABLE (
  id uuid,
  nombre text,
  clave_sat text,
  tipo_iva text,
  tasa_iva_default numeric,
  clave_unidad_sat text,
  nombre_unidad text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, patron AS nombre, clave_sat, tipo_iva, tasa_iva_default, clave_unidad_sat, nombre_unidad
  FROM public.catalogo_claves_sat
  WHERE organization_id = p_org
    AND activo = true
    AND lower(patron) = lower(p_nombre)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolver_producto_sat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_producto_sat(uuid, text) TO authenticated, service_role;
