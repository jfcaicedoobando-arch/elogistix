## Cambio
Reordenar las pestañas del detalle de embarque para que después de **Seguros** sigan: **Facturación → Conciliación → P&L → Cierre → Notas y Actividad**.

## Orden actual
Seguros · P&L · Facturación · Conciliación · Cierre · Notas y Actividad

## Orden nuevo
Seguros · Facturación · Conciliación · P&L · Cierre · Notas y Actividad

## Archivo afectado
- `src/features/embarques/components/EmbarqueDetalleTabs.tsx` — reordenar los `TabsTrigger` (líneas 97-102). El contenido (`TabsContent`) no cambia de orden visual porque cada tab se renderiza por su `value`, pero por consistencia y legibilidad también se reordenan los bloques `TabsContent`.

## Sin cambios
- No se renombran tabs ni se cambia el `value` de ninguno (no rompe deep-links como `?tab=facturacion`).
- No se toca lógica ni estilos.
- Bump de versión a `13.139.5` + entrada en `CHANGELOG.md`.