# Auditoría de `@tanstack/react-table` + plan de mejoras

## Veredicto general

**Sí, sigue buenas prácticas — y con un nivel poco común.** Todo el proyecto pasa por una única capa (`src/components/shared/DataTable.tsx` + `useTableInstance` + `VirtualDataTable`); un `grep` de `useReactTable(` fuera de esa capa devuelve **0 resultados**. Estamos en versiones actuales (`react-table 8.21.3`, `react-virtual 3.14.5`), sin flags de debug, con `getRowId` estable obligatorio (`rowKey`), `meta` tipado por module augmentation, `flexRender` en headers y celdas, y una separación deliberada: paginación y filtros viven fuera de TanStack (nuqs + `useServerPagedList`/`useClientPagedList`), lo que elimina el bug clásico de "double-filtering". Además hay tests de performance dedicados (`DataTable.perf.test.tsx`) que blindan estabilidad de referencias.

Hay **dos brechas reales** que vale la pena cerrar y **tres mejoras menores**. Nada urgente; nada mal diseñado.

## Analogía

Piensa en la tabla como un carro: motor y transmisión (sorting) son TanStack; volante y GPS (paginación y filtros) los pusimos aparte porque queríamos que el URL fuera "el mapa". Todo bien afinado. Faltan dos cosas: los intermitentes para peatones ciegos (`aria-sort`) y usar el sistema de asientos del propio carro en vez del que armamos aparte (row selection).

## Qué está bien (para no tocarlo)

- Una sola abstracción compartida usada por el 100% de las tablas (embarques, facturación, cotizaciones, proveedores, CRM, admin, portal).
- Paginación/filtros **fuera** de los row models de TanStack → sin doble filtrado.
- `getRowId` obligado vía prop `rowKey` (`DataTable.tsx:92-102`).
- `meta` tipado (`columnMeta.ts:12-25`), sin `any`.
- `flexRender` en headers y cells.
- Tests: `DataTable.perf`, `DataTable.e2e`, `DataTable.regression`, `DataTable.virtual`, `columnBuilders`, `sortingFns`, `useServerPagedList`, `useClientPagedList`, `useColumnVisibility`.
- Versiones al día. Cero `debugTable`/`debugAll`.

## Mejoras propuestas (priorizadas)

### Alta

**1. Unificar selección de filas con el estado nativo de TanStack**
Hoy `useRowSelection.ts` mantiene un `Set<string>` paralelo y `buildSelectionColumn.tsx` dibuja checkboxes a mano. Es una segunda fuente de verdad que puede desincronizarse del `getRowModel()`. Migramos a `state.rowSelection` + `onRowSelectionChange` + `enableRowSelection` en `useTableInstance`, y los checkboxes usan `row.getToggleSelectedHandler()` / `table.getToggleAllRowsSelectedHandler()`. API pública del hook se mantiene (`selected`, `toggle`, `clear`) para no romper call-sites.

Archivos: `useTableInstance.ts`, `useRowSelection.ts`, `buildSelectionColumn.tsx`, `DataTable.tsx` (pasar props de selección al instance). Tests: actualizar `DataTable.e2e.test.tsx` y añadir uno específico de "select-all + página".

**2. Accesibilidad en headers ordenables**
Añadir `aria-sort="ascending|descending|none"` y `scope="col"` en `DataTableHeaderRow.tsx:39-68`. Hoy la ordenación se comunica solo por icono → invisible para lectores de pantalla.

Archivo: `DataTableHeaderRow.tsx`. Test: extender `DataTable.e2e.test.tsx` para verificar `aria-sort` al hacer click.

### Media

**3. Contrato tipado de `sortableKeys`**
`useServerPagedList.ts:49-76` acepta `sortableKeys: string[]`. Un typo entre el `column.id` y la clave permitida silenciosamente no ordena. Cambiamos a un genérico `TSortKey extends string` para que TypeScript amarre `column.id` con la lista.

**4. Consistencia en column builders**
- Eliminar el `as ColumnDef<ClienteRow, unknown>` de `clientesTableConfig.tsx:26-29` usando `defineColumns<T>` como el resto.
- Auditar los builders que devuelven un array fresco (p.ej. `clientesTableConfig`) para garantizar que su call-site los envuelva en `useMemo` o los eleve a constante de módulo. Añadir una regla eslint mínima o comentario JSDoc en `defineColumns` recordando el patrón.

**5. Umbral documentado para virtualización**
Añadir en `DataTable.tsx` un `console.warn` (solo `import.meta.env.DEV`) si `rows.length > 200` y no se está usando `VirtualDataTable`, para forzar la decisión explícita. No cambia comportamiento en prod.

### Baja (dejar para después)

- Column pinning nativo (`state.columnPinning`) sólo si aparece un caso de pinning reordenable — el patrón CSS actual (`meta.sticky`/`stickyRight`) es suficiente hoy.
- Considerar `React.memo` en la fila del `DataTableBody` no virtualizado si aparece un caso con muchos rows sin paginar — hoy no está justificado.

## Alcance de la implementación (si se aprueba)

Fase 1 (alta prioridad, un solo PR): items **1** y **2** + tests + `CHANGELOG.md` + bump `APP_VERSION` a `13.286.0`.

Fase 2 (media prioridad, PR separado): items **3**, **4** y **5** + bump a `13.286.1`.

## Preguntas abiertas (para responder antes de construir)

1. ¿Arrancamos por Fase 1 (selección nativa + a11y) o quieres las 5 mejoras juntas en un solo lote?
2. ¿Hay tablas conocidas con >500 filas sin paginar que debamos migrar a `VirtualDataTable` como parte de esto? (No pude verificar volumen real de datos por ruta.)
3. En la unificación de selección: ¿mantenemos la API `useRowSelection({ selected, toggle, clear })` como wrapper sobre el estado de TanStack (más seguro para call-sites existentes) o exponemos directamente el estado del `table`?

## Notas técnicas para el implementador

- `useTableInstance` ya centraliza el `useReactTable`; añadir `state.rowSelection` y `onRowSelectionChange` ahí y propagarlos hacia arriba vía props opcionales en `DataTable`.
- Para `aria-sort`, TanStack expone `header.column.getIsSorted()` que devuelve `"asc" | "desc" | false` — traducir a los valores ARIA es una función pura de 3 líneas.
- El test de perf (`DataTable.perf.test.tsx`) es el guardián: cualquier cambio en `useTableInstance` debe pasar su presupuesto de re-render.
- No tocar la política de "no `getFilteredRowModel`/`getPaginationRowModel`" — es intencional y está documentada.
