# Proformas pendientes no aparecen en `/proformas`

## Diagnóstico

La proforma **PRO-2026-0949** (embarque ELIMP00285) existe pero está en estado `pendiente` (aún no aprobada por contabilidad). La página `/proformas` usa `useProformas()` que llama a `fetchProformasAprobadas` — sólo trae aprobadas + facturadas, nunca pendientes. El filtro "Todas / Pendiente / Facturada" del tab está allí pero nunca recibe filas pendientes del backend, por eso el usuario cree que la proforma "desapareció".

**Analogía:** Es como un buzón que dice "Todos / Sin abrir / Leídos" pero el cartero sólo entrega los ya abiertos — los "sin abrir" nunca llegan a esa bandeja.

Dónde vive hoy la proforma pendiente:
- Módulo **Facturación → tab "Por Timbrar"** (usa `useProformasPendientes`), donde se aprueba/consolida.

## Cambio propuesto

Unificar el listado de `/proformas` para que muestre **las tres etapas** (pendiente, aprobada, facturada) con el filtro que ya existe funcionando de verdad.

### 1. `src/features/embarques/hooks/useProformas.ts`
Agregar un hook `useProformasTodas()` que combine `fetchProformasPendientes` + `fetchProformasAprobadas` en un solo array normalizado al shape `ProformaConFactura` (las pendientes carecen de `folio_factura_externa` / `fecha_facturacion`, se rellenan con `null`).

### 2. `src/features/facturacion/hooks/useTabProformasController.ts`
Cambiar `useProformas()` → `useProformasTodas()` cuando el tab se monta desde la ruta `/proformas`. Para no romper el uso interno dentro de Facturación (donde ese tab quizás sí quiera sólo aprobadas), añadir un flag opcional `incluirPendientes?: boolean` al controller y pasarlo desde `ProformasListado.tsx`.

### 3. `src/features/facturacion/hooks/useTabProformasState.ts`
El `counts` ya calcula `pendiente / facturada / todas`; sólo hay que confirmar que el default de filtro sea `"todas"` (ya lo es) para que 0949 aparezca al abrir la página.

### 4. Columna de estado
`proformasColumns.tsx` ya renderiza `estado_proforma`. Verificar que el badge `"pendiente"` tenga estilo (amarillo/naranja) y que la acción "Marcar facturada" quede deshabilitada en filas pendientes (no aprobadas todavía) — mostrar tooltip: *"Primero apruébala en Facturación → Por Timbrar"*.

### 5. Versionado
- Bump `APP_VERSION` a `13.142.11`.
- Entrada en `CHANGELOG.md`: "Listado `/proformas` ahora incluye proformas pendientes con badge de estado."

## Fuera de alcance
- No se toca la lógica de aprobación/consolidación (sigue en Facturación → Por Timbrar).
- No se cambia RLS ni RPCs.
- No se agregan tests nuevos (el controller ya tiene cobertura; sólo se pasa un flag).
