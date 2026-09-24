# Corrección de selección efectiva en aprobaciones

## Objetivo
Impedir que una factura oculta, bloqueada o ya no elegible permanezca en el lote de aprobación.

## Cambios
- Limpiar la selección al cambiar la búsqueda, igual que al cambiar de pestaña.
- Derivar una sola lista efectiva desde las filas visibles, pendientes, seleccionadas y no bloqueadas por segregación de funciones.
- Usar esa lista para conteo, totales, validación SAT, justificación y envío.
- Impedir abrir o confirmar un lote vacío.
- Agregar regresiones focales para cambio de búsqueda y cambio de elegibilidad/SoD.

## Validación
- Ejecutar únicamente las pruebas focales del módulo, revisión de tipos y lint focal.
- No ejecutar CI/RLS completos, no publicar y no cambiar versión ni CHANGELOG.
