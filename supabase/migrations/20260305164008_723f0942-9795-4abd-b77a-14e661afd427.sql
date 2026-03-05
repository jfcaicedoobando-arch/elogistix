
-- 1. cotizaciones: agregar num_contenedores
ALTER TABLE public.cotizaciones
ADD COLUMN num_contenedores integer NOT NULL DEFAULT 1;

-- 2. embarques: agregar cotizacion_id
ALTER TABLE public.embarques
ADD COLUMN cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE SET NULL;

-- 3. cotizacion_costos: agregar columnas de P&L
ALTER TABLE public.cotizacion_costos
ADD COLUMN precio_venta numeric NOT NULL DEFAULT 0,
ADD COLUMN precio_total numeric GENERATED ALWAYS AS (cantidad * precio_venta) STORED,
ADD COLUMN profit numeric GENERATED ALWAYS AS (cantidad * precio_venta - cantidad * costo_unitario) STORED,
ADD COLUMN porcentaje_profit numeric GENERATED ALWAYS AS (
  CASE WHEN (cantidad * precio_venta) = 0 THEN 0
  ELSE ROUND(((cantidad * precio_venta - cantidad * costo_unitario) / (cantidad * precio_venta)) * 100, 2)
  END
) STORED,
ADD COLUMN unidad_medida text NOT NULL DEFAULT 'Contenedor';
