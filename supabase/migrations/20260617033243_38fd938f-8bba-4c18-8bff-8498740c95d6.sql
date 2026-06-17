
-- ============================================================
-- Bloque O: Integridad de datos del ciclo de embarque
-- ============================================================

-- 1. proveedor_facturas.embarque_id -> FK real
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_embarque_id_fkey
  FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE SET NULL;

-- 2. facturas.cotizacion_id (nueva columna + FK + backfill)
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS cotizacion_id uuid
  REFERENCES public.cotizaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_cotizacion_id
  ON public.facturas(cotizacion_id);

UPDATE public.facturas f
SET cotizacion_id = e.cotizacion_id
FROM public.embarques e
WHERE f.embarque_id = e.id
  AND e.cotizacion_id IS NOT NULL
  AND f.cotizacion_id IS NULL;

-- 3. pagos_factura.embarque_id (denormalizado + índice + backfill + trigger)
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS embarque_id uuid
  REFERENCES public.embarques(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_factura_embarque
  ON public.pagos_factura(embarque_id);

UPDATE public.pagos_factura pf
SET embarque_id = f.embarque_id
FROM public.facturas f
WHERE pf.factura_id = f.id
  AND f.embarque_id IS NOT NULL
  AND pf.embarque_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_pago_factura_embarque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.factura_id IS NOT NULL AND NEW.embarque_id IS NULL THEN
    SELECT embarque_id INTO NEW.embarque_id
    FROM public.facturas
    WHERE id = NEW.factura_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pago_factura_embarque ON public.pagos_factura;
CREATE TRIGGER trg_sync_pago_factura_embarque
  BEFORE INSERT OR UPDATE OF factura_id ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.sync_pago_factura_embarque();

-- 4. comisiones_devengadas: índice por embarque_id
CREATE INDEX IF NOT EXISTS idx_com_dev_embarque
  ON public.comisiones_devengadas(embarque_id);

-- 5. pagos_proveedor.cuenta_bancaria_id -> FK
ALTER TABLE public.pagos_proveedor
  ADD CONSTRAINT pagos_proveedor_cuenta_bancaria_id_fkey
  FOREIGN KEY (cuenta_bancaria_id) REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL;

-- 6. embarque_garantias_contenedor.proveedor_factura_id (nueva FK opcional)
ALTER TABLE public.embarque_garantias_contenedor
  ADD COLUMN IF NOT EXISTS proveedor_factura_id uuid
  REFERENCES public.proveedor_facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_garantias_proveedor_factura
  ON public.embarque_garantias_contenedor(proveedor_factura_id);

-- 7. conceptos_factura.clave_sat (default freight forwarding)
ALTER TABLE public.conceptos_factura
  ADD COLUMN IF NOT EXISTS clave_sat text NOT NULL DEFAULT '78101800';
