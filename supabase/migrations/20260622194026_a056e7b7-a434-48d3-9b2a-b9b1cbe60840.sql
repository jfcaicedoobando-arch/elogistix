-- 1) Tabla de secuencias por organización + tipo
CREATE TABLE IF NOT EXISTS public.folio_secuencias (
  organization_id uuid NOT NULL,
  tipo text NOT NULL,
  ultimo_numero bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, tipo)
);

GRANT SELECT ON public.folio_secuencias TO authenticated;
GRANT ALL ON public.folio_secuencias TO service_role;

ALTER TABLE public.folio_secuencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folio_secuencias lectura org"
ON public.folio_secuencias FOR SELECT
TO authenticated
USING (organization_id = current_user_org_id());

-- 2) Columna folio_interno (nullable para backfill)
ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS folio_interno text;

-- 3) Backfill cronológico de las facturas existentes por organización
WITH ordered AS (
  SELECT id, organization_id,
         row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS n
  FROM public.proveedor_facturas
  WHERE folio_interno IS NULL
)
UPDATE public.proveedor_facturas pf
SET folio_interno = 'FP-' || lpad(o.n::text, 6, '0')
FROM ordered o
WHERE pf.id = o.id;

-- Sincronizar contador con el máximo backfilleado
INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'factura_proveedor', count(*)
FROM public.proveedor_facturas
WHERE folio_interno IS NOT NULL
GROUP BY organization_id
ON CONFLICT (organization_id, tipo)
DO UPDATE SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
              updated_at = now();

-- 4) NOT NULL + índice único por organización
ALTER TABLE public.proveedor_facturas
  ALTER COLUMN folio_interno SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_facturas_folio_interno_org_uq
  ON public.proveedor_facturas (organization_id, folio_interno)
  WHERE deleted_at IS NULL;

-- 5) RPC atómica para obtener el siguiente folio
CREATE OR REPLACE FUNCTION public.siguiente_folio_proveedor(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (p_org_id, 'factura_proveedor', 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;

  RETURN 'FP-' || lpad(v_num::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.siguiente_folio_proveedor(uuid) TO authenticated, service_role;

-- 6) Trigger BEFORE INSERT: asigna folio si viene NULL
CREATE OR REPLACE FUNCTION public.set_folio_interno_proveedor_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folio_interno IS NULL OR NEW.folio_interno = '' THEN
    NEW.folio_interno := public.siguiente_folio_proveedor(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_folio_interno_proveedor_factura ON public.proveedor_facturas;
CREATE TRIGGER trg_set_folio_interno_proveedor_factura
BEFORE INSERT ON public.proveedor_facturas
FOR EACH ROW
EXECUTE FUNCTION public.set_folio_interno_proveedor_factura();