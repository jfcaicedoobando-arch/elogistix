# Refactor de tablas a TanStack — estado real y plan de cierre

## Punto de partida (importante)

Este refactor **ya se ejecutó** en mensajes anteriores de esta sesión y la app está en `APP_VERSION 10.1.2`. Verifiqué el código en vivo y los directivos del mensaje ya se cumplen:

| Directiva                                                          | Estado actual                                                                                  |
|--------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| Eliminar lógica custom de orden/filtros/virtualización             | Hecho. `columnAdapter.ts` borrado, `DataTableColumn<T>`/`SortValue` removidos.                |
| Re-implementar tabla con `@tanstack/react-table` + `@tanstack/react-virtual` | Hecho. `DataTable.tsx`, `VirtualDataTable.tsx`, `useTableInstance.ts` consumen exclusivamente el API nativo. |
| Integración limpia con Supabase                                    | Hecho. Patrón `sortMode="server" + controlledSort + onSortChange` mapea 1:1 a `.range()`/`order()` en RPCs. |
| Cero `useEffect` que ordene arrays                                 | Verificado: `rg "\.sort\("` en `src/components/shared/dataTable/` sólo encuentra menciones en comentarios. |

Además ya existen: suite de regresión (16 tests), suite E2E (10 tests), benchmark de perf (6 tests, 10k filas en 124ms), `docs/datatable-columndef-guide.md` y `docs/datatable-perf-audit.md`.

**Por eso este plan NO re-ejecuta el refactor.** Propongo una pasada de verificación y limpieza para dejar el trabajo formalmente cerrado y eliminar el ruido residual de la API legacy.

## Lo que sí queda por hacer

### 1. Limpieza de menciones legacy en comentarios

Tres archivos siguen citando símbolos que ya no existen (`DataTableColumn<T>`, `columnAdapter.ts`, `sortValue`). Son sólo bloques de documentación interna, pero confunden a quien lee el código por primera vez:

- `src/components/shared/DataTable.tsx` (líneas 127, 130) — actualizar el JSDoc para que describa el estado actual, no la migración histórica.
- `src/components/embarque/embarqueColumns.tsx` (líneas 24-25) — quitar la referencia a "Fase 1 en `columnAdapter.ts`".
- `src/components/shared/dataTable/sortingFns.ts` (línea 6) — el comentario "replican lo que el adapter legacy aplicaba detrás de `sortValue`" ya no aporta; reescribir explicando el contrato actual (null-last, colación es-MX) sin referencia al pasado.

### 2. Verificación de cumplimiento end-to-end

Correr la suite completa (`bun run ci:local` o equivalente: lint + tests + build) y reportar:

- 26+ tests de DataTable pasan.
- 6 benchmarks pasan dentro del presupuesto.
- `rg "\.sort\(" src/components` no encuentra reordenamientos manuales sobre `data` en componentes de tabla.
- `rg "DataTableColumn|sortValue|columnAdapter|useDataTableSort" src/` sólo encuentra menciones en `src/content/changelog/**` (histórico, intocable).

### 3. Resumen ejecutivo "step-by-step" para el equipo

Generar un anexo en `docs/datatable-columndef-guide.md` (o un archivo nuevo `docs/refactor-tanstack-summary.md`) que describa, paso a paso y en orden cronológico, qué se hizo en cada fase y por qué. Sirve como referencia única cuando alguien pregunte "¿qué pasó con `DataTableColumn`?" o "¿por qué `VirtualDataTable` no tiene sort cliente?".

Contenido propuesto (uno a uno):

1. **Fase 1 — Adapter intermedio.** Se introdujo `columnAdapter.ts` para que call-sites legacy y nativos coexistieran. Decisión: migrar a `@tanstack/react-table` v8 nativo en lugar de mantener nuestra propia capa.
2. **Fase 2 — Helpers de orden.** Se creó `sortingFns.ts` con `sortByString` (`Intl.Collator("es-MX")`), `sortByNumber` y `sortByDate`, todos null-last, para reemplazar `sortValue` sin perder colación mexicana ni el manejo de nulos.
3. **Fase 3 — Migración total y borrado del adapter.** Los ~30 call-sites se reescribieron a `defineColumns<T>` + `ColumnDef<T, unknown>`. Se eliminó `columnAdapter.ts` y los tipos `DataTableColumn<T>`/`SortValue`. `useTableInstance` quedó como único orquestador (sort server-side vs. cliente, sin `useState` paralelos).
4. **Virtualización.** `VirtualDataTable` consume `table.getRowModel().rows` (no `data` crudo) y conecta `useVirtualizer` con `measureElement`, `estimateSize`, `gridTemplate` y `getRowId` memoizados, más `React.memo(VirtualRow)` con comparador propio. Resultado: rerender de 5k filas en ~2ms.
5. **Integración con Supabase.** Patrón canónico: estado local `{ key, dir }` y `page`, pasados a un hook que llama Supabase con `.order(key, { ascending: dir==="asc" }).range(...)`. `onSortChange` actualiza el estado y resetea `page=0`; el componente no reordena nada en cliente (`sortMode="server"` implica `manualSorting: true`).
6. **Tests.** Regresión (16) + E2E (10) + perf (6) bloquean cualquier reintroducción de `useMemo([...data].sort(...))`, `useEffect` que rehidrate orden o pérdida de identidad del `rowModel`.
7. **Documentación.** `docs/datatable-columndef-guide.md` (receta + checklist de PR) y `docs/datatable-perf-audit.md` (presupuestos y garantías invariantes).

### 4. Versionado y changelog

Subir `APP_VERSION` a `10.1.3` con entrada `patch` en `chunk0.ts` y `changelogData.ts`: "Limpieza de menciones legacy en JSDoc y resumen step-by-step del refactor a TanStack".

## Lo que NO voy a hacer (y por qué)

- **No re-ejecutar la migración**: ya está hecha. Volver a tocar `DataTable.tsx`/`VirtualDataTable.tsx` sin caso de uso nuevo es riesgo gratuito sobre ~30 call-sites estables.
- **No cambiar el patrón server-side a `getFilteredRowModel` cliente**: los datasets reales del ERP (embarques, cotizaciones, audit log) llegan paginados de Supabase. Forzar filtro cliente rompería la paginación server y la perf que ya medimos.
- **No introducir un wrapper "amigable"** sobre `ColumnDef`: ya tenemos `defineColumns<T>` + helpers `sortByString/Number/Date`. Añadir otra capa volvería a reabrir la deuda que acabamos de cerrar.

## Detalles técnicos para implementar después de aprobar

- Archivos a editar: `DataTable.tsx`, `embarqueColumns.tsx`, `sortingFns.ts` (sólo JSDoc), `appVersion.ts`, `changelogData.ts`, `chunk0.ts`, opcional `docs/refactor-tanstack-summary.md` nuevo.
- Comandos de verificación: `bunx vitest run src/components/shared/dataTable/__tests__/` y `rg -n "DataTableColumn|sortValue|columnAdapter" src/components/ src/pages/`.
- Sin cambios en runtime, sin cambios visuales, sin cambios en RPCs.

Si prefieres que en vez de cerrar formalmente, busque algún módulo concreto donde sospechas que el patrón TanStack no está bien aplicado, dímelo y ajusto el plan.
