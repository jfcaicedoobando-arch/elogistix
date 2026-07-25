-- QW2 (v13.315.8) — Agregar días de crédito a proveedores.
-- Motivo: la ficha de cliente sí lleva días de crédito y auto-calcula el
-- vencimiento; en compras se tecleaba a mano. Este campo permite prellenar
-- fecha_vencimiento = fecha_emision + dias_credito al capturar facturas de
-- proveedor (manual, XML o PDF). Editable siempre por el usuario.
ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS dias_credito integer NOT NULL DEFAULT 0
  CHECK (dias_credito >= 0);

COMMENT ON COLUMN public.proveedores.dias_credito IS
  'Días de crédito por defecto para calcular fecha_vencimiento al capturar facturas de proveedor. 0 = contado.';