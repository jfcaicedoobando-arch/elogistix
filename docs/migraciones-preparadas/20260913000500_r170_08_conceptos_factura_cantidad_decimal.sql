-- R170-08 · Persistencia decimal de cantidad en conceptos de factura.
--
-- ESTADO: PREPARADA, NO APLICADA. Requiere autorización explícita del usuario
-- para aplicarse (la autorización previa cubría sólo R170-02). Al autorizarse,
-- este SQL debe aplicarse por el mecanismo de migraciones del backend, que
-- crea el archivo real en `supabase/migrations/`.
--
-- Hallazgo físico: el editor de conceptos de una factura Borrador ya conserva
-- el punto decimal y bloquea cantidad cero, pero guardar `1.5` falla con
-- 22P02 `invalid input syntax for type integer: "1.5"`.
--
-- Causa: `public.conceptos_factura.cantidad` es `integer`, mientras el
-- contrato fiscal canónico del cliente (`parseCantidadFiscal`, hasta 6
-- decimales por CFDI 4.0) y las tablas hermanas (`conceptos_venta`,
-- `cotizacion_costos`, `proforma_conceptos_consolidados`) ya usan `numeric`.
--
-- Alcance: sólo el tipo de la columna y el CHECK de positividad. No redondea,
-- trunca ni normaliza datos existentes (todo entero es representable), no toca
-- RLS, permisos, triggers, funciones ni datos históricos.

ALTER TABLE public.conceptos_factura
  ALTER COLUMN cantidad TYPE numeric(18, 6) USING cantidad::numeric,
  ALTER COLUMN cantidad SET DEFAULT 1;

-- Positividad conservada (nunca 0 ni negativos) y los enteros siguen siendo
-- válidos; se admiten fracciones legítimas (0.5 TON, 1.5 TON) que el CHECK
-- `>= 1` rechazaba.
ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_cantidad_pos;

ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_cantidad_pos CHECK (cantidad > 0);

COMMENT ON COLUMN public.conceptos_factura.cantidad IS
  'Cantidad fiscal del concepto: numeric(18,6) positivo (CFDI 4.0 admite 6 decimales). R170-08.';
