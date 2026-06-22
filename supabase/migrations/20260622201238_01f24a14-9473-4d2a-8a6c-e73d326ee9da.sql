-- 1) proveedores.categoria: dejar nullable (la categoría contable ya no se asigna al proveedor).
ALTER TABLE public.proveedores ALTER COLUMN categoria DROP NOT NULL;

-- 2) Backfill: asegurar categoría "Sin categoría" por organización para facturas sin categoría.
INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
SELECT DISTINCT pf.organization_id, 'Sin categoría', 9999, true
FROM public.proveedor_facturas pf
WHERE pf.categoria_presupuesto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.presupuesto_categorias pc
    WHERE pc.organization_id = pf.organization_id AND pc.nombre = 'Sin categoría'
  );

UPDATE public.proveedor_facturas pf
SET categoria_presupuesto_id = pc.id
FROM public.presupuesto_categorias pc
WHERE pf.categoria_presupuesto_id IS NULL
  AND pc.organization_id = pf.organization_id
  AND pc.nombre = 'Sin categoría';

-- 3) Hacer categoria_presupuesto_id NOT NULL en proveedor_facturas.
ALTER TABLE public.proveedor_facturas
  ALTER COLUMN categoria_presupuesto_id SET NOT NULL;