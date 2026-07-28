## Ola 4 — Cerrar la adopción de `DetailHeader`

Tras las olas 1–3 quedan **dos** páginas de detalle fuera del estándar (verificado con `rg`: son los únicos archivos en `src/features/*/routes/*Detalle*.tsx` que no importan `DetailHeader`). El resto de los `ArrowLeft` que quedan en el código son de wizards/diálogos (pasos) y páginas legales/404 — esos se quedan como están, a propósito.

### 1. Embarque Detalle (el más importante)
`src/features/embarques/components/EmbarqueDetalleHeader.tsx` dibuja hoy su propio `<h1>` + subtítulo + acciones en un flex, y **no tiene botón "Volver"** en absoluto: desde el detalle de un embarque el usuario sólo puede regresar con el botón del navegador.

Cambio: envolver el contenido actual en `DetailHeader` sin tocar la lógica de estados ni los diálogos.
- `backTo="/embarques"`, `backLabel="Embarques"`.
- `title` = expediente (`labelExpediente`), `badge` = `EmbarqueStatusChip` + `EmbarqueBadgeAdmin`.
- `subtitle` = cliente + enlace a cotización origen (idéntico a hoy, incluyendo el aviso de "Sin cotización vinculada").
- `trailing` = `<EmbarqueDetalleHeaderActions />` con las mismas props.
- `EmbarqueHeaderDialogs` se queda como hermano, fuera del header visual.

### 2. Tarifario / Cotización informativa
`src/features/cotizacion/routes/CotizacionInformativaDetalle.tsx` usa `PageHeader` (componente de listados) y mete un `<Button>Volver</Button>` entre las acciones de la derecha.

Cambio: sustituir por `DetailHeader` con `backTo`/`onBack` a la izquierda y dejar sólo "Descargar PDF" en `trailing`. Recibe `onBack` como prop, así que el botón Volver usará ese callback (se añadirá soporte de `onBack` opcional en `DetailHeader`, o se pasará la ruta directa si el callback sólo navega a `/cotizaciones`; se decide al leer el componente padre).

### 3. Reforzar el guardrail
`src/__tests__/architecture/detail-header-canonical.test.ts` hoy sólo prohíbe `ArrowLeft` en rutas `*Detalle*.tsx`. Se ampliará para exigir que cada ruta de detalle **importe `DetailHeader`** (directa o vía su componente de header), con allowlist explícita para `EmbarqueDetalleStates.tsx` (estados de error/vacío, no es un detalle real).

### 4. Cierre
- `bun run lint --max-warnings 0`, `tsgo --noEmit` y los tests de `embarques` + `cotizacion` + arquitectura.
- Bump `APP_VERSION` a `13.320.68` y entrada en `CHANGELOG.md`.

### Nota técnica
No se toca lógica de negocio: `useEmbarqueEstadoActions`, permisos, diálogos de bloqueo por documentos y la generación de PDF del tarifario quedan intactos. El riesgo es puramente visual (posición del botón Volver y truncado del título en móvil), y se verificará con captura a 1920 y 390 px.
