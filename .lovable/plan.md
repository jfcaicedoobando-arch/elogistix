## Contexto

En v13.300.8 corregí un bug en la tabla de `/usuarios`: sólo se veía la columna "Usuario" porque el `<table>` interno del `DataTable` compartido usa `min-w-max` por defecto, y cuando una celda contiene un componente "pesado" (Select, Popover, Input sin ancho), el navegador estira la tabla a miles de píxeles y esconde el resto de las columnas.

Analogía: `min-w-max` es como decirle a la tabla "nunca te encojas por debajo de tu tamaño ideal". Si dentro de una celda pones un Select con muchas opciones, ese "ideal" se dispara y el resto de columnas se sale del viewport.

El fix ya aplicado (`UsuariosInternosTab.tsx` y `PortalUsuariosTab.tsx`) fue pasar `tableClassName="w-full"` al `DataTable`.

## Hallazgos de la auditoría

Un subagente revisó los ~120 archivos que consumen `DataTable`. Sólo hay **3 tablas con el mismo patrón de riesgo** que aún no están corregidas:

| # | Archivo | Componente pesado en `cell:` | Severidad |
|---|---|---|---|
| 1 | `src/features/admin/components/orgDetalle/OrgMembersCard.tsx` | `<Select>` de roles (mismo patrón exacto que el bug original) | Alta |
| 2 | `src/features/embarques/components/TabGarantias.tsx` (columnas en `useGarantiasColumns.tsx`) | `<Input>` de monto/ref + `<Select>` de estado, sin `meta.width` declarado | Alta/Media |
| 3 | `src/features/embarques/components/TabDemoras.tsx` (columnas en `tabDemorasColumns.tsx`) | `<DatePickerMx>` (Popover con calendario) + `<Input>` de días libres | Media |

Confirmado que **no hay más ocurrencias**: los demás Selects/Popovers viven en toolbars de filtro fuera de la tabla, no en `cell:`.

Además, `VirtualDataTable.tsx` usa CSS grid en vez de `<table>` y no está expuesto al bug.

## Plan de corrección

### Paso 1 — Aplicar el fix mínimo a los 3 archivos afectados

Pasar `tableClassName="w-full"` al `<DataTable>` en:

- `src/features/admin/components/orgDetalle/OrgMembersCard.tsx` (línea del `<DataTable ...>`)
- `src/features/embarques/components/TabGarantias.tsx`
- `src/features/embarques/components/TabDemoras.tsx`

Es una sola prop añadida por archivo, sin cambios de lógica ni de datos.

### Paso 2 — Verificación visual con Playwright

Reproducir el flujo para cada una:

1. Navegar a `/admin/organizaciones/:id` (`OrgMembersCard`) y abrir la pestaña de miembros.
2. Abrir un embarque con garantías y verificar la tabla de `TabGarantias`.
3. Abrir un embarque con demoras y verificar la tabla de `TabDemoras`.

Capturar screenshot en cada una y confirmar que todas las columnas caben dentro del contenedor (sin scroll horizontal desmedido).

### Paso 3 — Registro de cambios

- Bump `APP_VERSION` a `13.300.9` (`src/constants/appVersion.ts`).
- Entrada nueva en `CHANGELOG.md` describiendo el fix preventivo y los 3 archivos afectados, referenciando `13.300.8` como la corrección original.

## Detalles técnicos

- El prop `tableClassName` ya existe en `src/components/shared/DataTable.tsx` (línea 55) desde la corrección anterior; el default sigue siendo `"min-w-max"` para no romper otras tablas que sí dependen de scroll horizontal.
- El fix es idempotente y no requiere cambios en las definiciones de columnas ni en los hooks de datos.
- No se tocan los componentes internos de las celdas (`<Select>`, `<Input>`, `<DatePickerMx>`), sólo la instancia del `<DataTable>` que las contiene.

## Riesgos

- Bajo: `w-full` puede provocar que las columnas se compriman si el contenido crece mucho. Mitigación: las tres tablas afectadas ya declaran `meta.width` en sus columnas críticas o contienen inputs con ancho fijo, por lo que el layout resultante debería mantenerse legible. La verificación visual del paso 2 sirve de red de seguridad.

## Fuera de alcance

- No se refactorizan las 100+ tablas restantes que técnicamente heredan `min-w-max` pero no muestran el bug (no tienen componentes pesados en `cell:`). Se dejan como están para no arriesgar regresiones en scrolls horizontales legítimos (por ejemplo tablas anchas de embarques o CXP).
- No se cambia el default de `DataTable.tsx`.
