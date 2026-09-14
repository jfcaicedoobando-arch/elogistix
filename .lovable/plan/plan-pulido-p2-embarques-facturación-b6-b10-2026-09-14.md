# Plan: Pulido P2 Embarques/Facturación B6–B10

## Cambios
- **B6 — Contenedores:** mantener visibles Peso, Volumen y Piezas cuando exista al menos un marcador pendiente; conservar el resumen uniforme sólo cuando todos estén capturados y respetar ceros explícitos válidos.
- **B7 — Facturas:** agrupar el subtotal vigente por moneda, excluir facturas canceladas del importe emitido y conservar el contador total de documentos.
- **B8 — Cierre:** alinear únicamente los dos mensajes de permisos con coordinación/gerencia de operaciones y administración, sin tocar autorización.
- **B9 — CSV:** extraer un helper pequeño compatible con RFC 4180 para escapar comas, comillas y saltos de línea, manteniendo columnas, valores y nombre del archivo.
- **B10 — Conceptos de venta:** renombrar la columna por fila a “Subtotal” y señalar los importes de las tarjetas como “Total c/ IVA”, sin modificar sus cálculos.

## Pruebas y cierre
- Agregar pruebas focalizadas para el caso mixto de contenedores, subtotales por moneda y canceladas, mensajes de cierre, escape CSV, y conceptos gravados/exentos.
- Ejecutar sólo Vitest focalizado, typecheck, lint focalizado y auditorías de versión/manifiesto/arquitectura.
- Actualizar `APP_VERSION`, `CHANGELOG.md`, manifiesto de release y roadmap conforme a la convención; no publicar ni ejecutar CI/RLS completos.

## Detalles técnicos
- Reutilizar `formatCurrency`, helpers financieros existentes y patrones de componentes actuales.
- No agregar dependencias, migraciones, RPCs, RLS, conversiones de moneda ni cambios de datos.
