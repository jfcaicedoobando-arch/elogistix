# Buzón de facturas de proveedor — mejoras de UI/UX

Auditoría visual hecha sobre la pantalla real (`/compras/buzon`) capturada en 1920×1080 con datos de producción (12 documentos pendientes).

## Lo que hoy funciona bien

- Semáforo de antigüedad (barra de color + badge "Hoy / 2 días / 3 días") legible de un vistazo.
- KPIs accionables que filtran la lista al hacer clic.
- Pestañas Pendientes / Capturadas / Rechazadas y toolbar con búsqueda, chips y orden.

## Problemas detectados y cómo resolverlos

### 1. Falta el dato más importante para contabilidad: el importe
La fila muestra proveedor, expediente, folio, fecha y nombre de archivo, pero **no el total ni la moneda**, aunque el buzón ya los guarda (`total_detectado`, `moneda_detectada`). Quien captura no puede priorizar ni detectar un monto raro sin abrir cada documento.
- Agregar una columna de importe alineada a la derecha del texto, en tabular-nums, con la moneda; cuando no haya dato detectado, mostrar "Sin importe" en tono apagado (y que ese caso sea filtrable con un chip nuevo).

### 2. El nombre de archivo domina la línea secundaria
Cadenas como `NQDEC260544829 DN Elogistix Shipping S de RL de CV (3) (1).pdf` empujan y opacan los datos útiles (expediente, folio, fecha).
- Reordenar la línea secundaria a: expediente · folio · fecha de emisión, y mover el nombre de archivo al final truncado y en tono más apagado (con tooltip para el nombre completo).
- Usar `fecha_emision` cuando exista (hoy siempre se muestra `created_at`), con etiqueta clara "Emitida" vs "Recibida".

### 3. Ruido de badges y jerarquía plana
"Proveedor sin identificar" + "Falta XML" compiten con el nombre real del proveedor y se repiten en casi todas las filas.
- Cuando no hay proveedor, mostrar el emisor detectado (RFC) como pista y el texto en tono apagado en cursiva, no como si fuera un nombre.
- Consolidar los avisos de la fila (falta XML, sin importe, ya capturado) en un grupo compacto y consistente a la derecha del proveedor.

### 4. Aprovechamiento del espacio en pantallas grandes
A 1920 px la fila estira el texto y deja un hueco grande entre los datos y los botones; la lectura en zig-zag cansa.
- Pasar la fila a una rejilla de columnas fijas (antigüedad | proveedor y datos | importe | acciones) para que todo quede alineado verticalmente entre filas.
- Usar `PageContainer width="wide"` como el resto de los listados densos de CxP.

### 5. Los KPIs no muestran qué filtro está activo
Se puede filtrar desde los KPIs y desde los chips, pero el KPI no se ve seleccionado; el usuario pierde de vista por qué la lista está recortada.
- Marcar visualmente el KPI activo (anillo/borde) y sincronizarlo con el chip.
- Cuando haya un filtro activo, mostrar junto al contador un botón "Limpiar filtros".

### 6. Acciones repetidas y sin foco
Cada fila repite "Ver" + "Capturar factura"; el botón "Ver" duplica el clic en la fila (que ya abre la vista previa).
- Dejar la acción primaria "Capturar factura" visible y mover "Ver" al menú de tres puntos (la fila completa ya abre la previa), reduciendo ~30% de peso visual por fila.
- Añadir estado de "en proceso" en el botón mientras abre el diálogo.

### 7. Estados vacíos y densidad
- Añadir un control de densidad (cómoda/compacta) o reducir el alto de fila para ver más documentos sin scroll en pantallas grandes.
- Mantener los textos vacíos actuales (ya son buenos) y agregar acción sugerida en "Buzón al día".

## Alcance técnico

Sólo capa de presentación de `src/features/bandejas/`:
- `components/FacturaEntranteRow.tsx` — rejilla de columnas, importe, orden de datos, badges.
- `components/FacturaEntranteAcciones.tsx` — acción primaria única + menú.
- `components/FacturasEntrantesToolbar.tsx` — botón limpiar filtros, contador.
- `components/BuzonEntrantesKpis.tsx` — estado activo del KPI.
- `routes/CxpBuzonEntrantes.tsx` — `width="wide"`, paso del chip activo a los KPIs.
- `lib/domain/facturasEntrantesBuzon.ts` — chip opcional "Sin importe" + helper de formato (con tests unitarios).

Sin cambios de base de datos ni de lógica de captura/rechazo. Se usan tokens semánticos existentes (`warning`, `info`, `destructive`, `muted-foreground`) y `formatCurrency` del proyecto. Se actualiza `CHANGELOG.md` y `APP_VERSION`.

## Verificación

- Captura Playwright en 1920×1080 antes/después de la lista.
- Revisión de 1366×768 para confirmar que la rejilla no rompe la fila de una línea.
- Tests unitarios de los helpers nuevos y `tsgo` + lint.
