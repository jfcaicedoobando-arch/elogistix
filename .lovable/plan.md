# Eliminar los `eslint-disable` restantes (causa raíz)

## Inventario

Auditoría: **30 directivas reales** en `src/**` + 1 doble entrada en `useEditarEmbarqueWizard` (las menciones en `changelogData.ts` y `chunks/0.ts` son strings de historial, no se cuentan). Distribución por regla:

| Regla | # | Archivos |
|---|---|---|
| `react-hooks/exhaustive-deps` | 14 | AuthContext, EditarEmbarque, useListPageState, useEmbarqueEstadoActions, useEditarEmbarqueWizard (×4), usePortalEmbarquesController, useAuditoriaSnapshots, useCotizacionWizardSteps, DialogBolContainers, VirtualDataTable |
| `complexity` | 5 | SentryDiagnostico, oportunidadPayload, leadPayload, VirtualDataTable |
| `@typescript-eslint/no-explicit-any` | 4 | appFeedback, useNuevoEmbarqueExpediente, exportListado, embarqueRoundtrip.test |
| `no-restricted-imports` | 3 | EmbarquesRelacionadosCard, DimensionesLCLTable, DimensionesAereasTable |
| `no-console` | 3 | DataTable.perf.test |
| `react-refresh/only-export-components` | 1 | DataTable.tsx |
| `no-control-regex` | 1 | storageUtils.test |

Objetivo: dejar **0 disables inline** salvo los justificados por reglas estructurales (que pasan a `eslint.config.js` con override por carpeta o a allowlists).

## Estrategia por categoría

### A. `exhaustive-deps` (14 ocurrencias)

Causa raíz casi siempre: **inicialización idempotente** (`if (initialized) return; ...; setInitialized(true)`) o **sync de URL/prop a estado** donde la setter o el callback son estables.

Fixes por caso (cada uno root-cause, sin volver a disable):

1. **`useEditarEmbarqueWizard.ts` (×4)** — patrón "init-once-per-id". Reescribir con `useRef<string|null>(null)` que guarda el `embarque.id` ya inicializado; el efecto compara `ref.current === embarque.id`. Las deps quedan en `[embarque, conceptosVentaDb, conceptosCostoDb, contactos, selectedCliente, inicializarVenta, inicializarCosto, methods]` honestas. Los inicializadores se obtienen de un `useStableCallbacks` (memoizados con `useCallback` en el origen — verificar `useConceptosForm`).
2. **`useEmbarqueEstadoActions.ts`** — deps actuales `[embarque?.id, embarque?.etd, embarque?.eta]` omiten `embarque.modo/tipo/estado` y `syncEstado`. Solución: capturar las 5 primitivas (`modo`, `tipo`, `etd`, `eta`, `estado`, `id`) como deps y agregar `syncEstado` (es estable porque `useMutation` devuelve la misma identidad por render).
3. **`useAuditoriaSnapshots.ts`** — `capturar` viene de `useCapturarSnapshotAuditoria()`. Igual que arriba: `mutate` es estable, agregarlo a deps; o usar `capturar.mutate` directamente (estable entre renders de un mismo mount).
4. **`usePortalEmbarquesController.ts`** — al sincronizar `searchParams` se omite `filtroEstado`. Usar el valor leído (`searchParams.get('estado')`) y comparar contra el estado vía la forma funcional de `setFiltroEstadoState((prev) => …)`. Elimina la dep faltante.
5. **`useListPageState.ts`** — el `useMemo([], …)` construye un mapa derivado de `defaultFilters`. Reemplazar por `useMemo(() => buildFilterParsers(defaultFilters), [JSON.stringify(Object.keys(defaultFilters).sort())])` o (mejor) extraer la construcción fuera del componente y memoizar por referencia de `defaultFilters` con `useRef` capturando la referencia inicial — eso satisface la regla.
6. **`EditarEmbarque.tsx`** — agregar `setCurrentStep` a deps (es estable de `useState`).
7. **`DialogBolContainers.tsx`** — añadir `ctrl.reset` a deps (extraer `const { reset } = ctrl` arriba para tener referencia estable; `reset` ya viene memoizado del hook controller).
8. **`useCotizacionWizardSteps.ts`** — convertir `handleSiguiente` en un `switch` que llame helpers ya memoizados con `useCallback`. Las deps reales son sólo `currentStep`, `handlePaso1`, `handlePaso2`, `handlePaso3`; envolver los `handlePasoN` en `useCallback` y reducir la lista.
9. **`VirtualDataTable.tsx`** (deps `[leafColumns.length, leafColumns.map(...).join('|')]`) — extraer ambas expresiones a `const` arriba del `useMemo` (`const widthsKey = leafColumns.map(...).join('|')`) y declarar `[widthsKey]` como dep. Satisface la regla con la misma semántica.
10. **`AuthContext.tsx`** — el comentario dice "signOut es estable". Si `signOut` viene de `useCallback`, basta con incluirlo en deps (no cuesta nada). Si no, envolver con `useCallback([])`.

### B. `complexity` (5)

11. **`oportunidadPayload.ts` y `leadPayload.ts`** — son mappers con ~10 `??` planos. Extraer `applyDefaults(input, defaults)` puro (1 línea reduce-fold) y eliminar el branching aparente. La complejidad cae <5 sin cambiar comportamiento. +tests unitarios mínimos.
12. **`SentryDiagnostico.tsx`** — partir JSX en `<SdkStatusCard />`, `<AuthContextCard />`, `<TestActionsCard />` (3 subcomponentes en `pages/dashboard/sentry/`). El render principal queda lineal (<15).
13. **`VirtualDataTable.tsx`** (la complejidad del cuerpo de la función) — extraer `withDefaults(props)` puro que devuelve el objeto desestructurado completo (1 sola sentencia). El componente queda con setup limpio.

### C. `no-explicit-any` (4)

14. **`lib/ui/appFeedback.ts`** — `AnyToastFn = (props: any) => unknown`. Causa raíz: aceptar dos firmas (shadcn `useToast` y sonner). Tipar como `type AnyToastFn = (props: { title?: string; description?: string; variant?: string; [k: string]: unknown }) => unknown`. Ya no es `any`.
15. **`hooks/embarque/useNuevoEmbarqueExpediente.ts`** — `methods: UseFormReturn<any>`. Restringir a la única forma usada: `UseFormReturn<{ blMaster: string }>` (`setValue('blMaster', …)`). Los call sites pasan `methods` cuyo form schema incluye `blMaster` — compatible.
16. **`services/embarque/queries/exportListado.ts`** — `applyFilters: (q: any) => any`. Tipar con `PostgrestFilterBuilder` de `@supabase/postgrest-js` parametrizado por el row schema (`Database['public']['Tables']['embarques']['Row']`). Patrón que ya usamos en `services/embarque/queries/listado.ts`.
17. **`lib/mappers/__tests__/embarqueRoundtrip.test.ts`** — cast de `any` para spying. Cambiar a `as unknown as Partial<EmbarqueDb>` o tipar el objeto de fixture explícitamente.

### D. `no-restricted-imports` (3)

18. **`DimensionesLCLTable.tsx` + `DimensionesAereasTable.tsx`** — tablas estáticas read-only. Mover ambas a la **allowlist** del bloque "Allowlist de tablas" en `eslint.config.js`. Elimina 2 disables inline; queda 1 punto central documentado.
19. **`EmbarquesRelacionadosCard.tsx`** — usa `TableRow/TableCell` para render row custom. Refactor real: el sub-array de relacionados se renderiza ya con `DataTable` arriba; el `TableRow` adicional es para una fila "ver detalle". Reemplazar por un `<button>` flex en celda `cell:` de la `defineColumns`, eliminando los imports primitivos. Si la refactor toca diseño, alternativa intermedia: añadirlo a la allowlist como las dos anteriores.

### E. `no-console` (3) y `no-control-regex` (1) — sólo tests

20. Añadir bloque en `eslint.config.js` para `**/*.test.{ts,tsx}` con:
    ```js
    "no-console": "off",
    "no-control-regex": "off",
    ```
    Justificación: los logs de perf y los regex de control son patrones legítimos sólo en tests. Elimina 4 disables inline con 1 override.

### F. `react-refresh/only-export-components` (1)

21. **`src/components/shared/DataTable.tsx`** — re-exporta `defineColumns` y tipos junto al componente. Fix root-cause: dejar el componente *solo* en `DataTable.tsx`, y crear `src/components/shared/dataTable/index.ts` (barrel sin JSX) con los re-exports (`DataTable`, `defineColumns`, tipos). Codemod (~80 archivos) cambia `from "@/components/shared/DataTable"` → `from "@/components/shared/dataTable"` (mismo nombre, otra cápsula). Sin disable.

## Pasos ordenados (un loop cada uno)

1. **Tests overrides en eslint.config.js** (paso E) — 1 archivo de config, elimina 4 disables. Trivial, gran ROI.
2. **Allowlist `DimensionesLCLTable/AereasTable`** (paso D parcial) — 1 archivo de config + 2 archivos editados, elimina 2 disables.
3. **`AuthContext.tsx` + `EditarEmbarque.tsx` + `DialogBolContainers.tsx`** (paso A simples) — 3 disables eliminados con cambios mínimos en deps.
4. **`useAuditoriaSnapshots`, `useEmbarqueEstadoActions`, `usePortalEmbarquesController`** (paso A medios) — 3 disables, root-cause via deps honestas o forma funcional.
5. **`useEditarEmbarqueWizard.ts` ×4 + `useListPageState` + `useCotizacionWizardSteps` + `VirtualDataTable` exhaustive-deps** (paso A complejos) — 7 disables, refactor a `useRef` por id o extracción de key.
6. **`no-explicit-any` (×4)** — tipados estrictos en `appFeedback`, `useNuevoEmbarqueExpediente`, `exportListado`, `embarqueRoundtrip.test`.
7. **`complexity` (×5)** — extracción de `applyDefaults`, split de `SentryDiagnostico` y `withDefaults` en `VirtualDataTable`. +tests.
8. **`EmbarquesRelacionadosCard.tsx`** — eliminar `TableRow/TableCell` primitivos refactorizando a celda `cell:` o fallback a allowlist documentada.
9. **`react-refresh` en `DataTable.tsx`** — crear barrel `components/shared/dataTable/index.ts`, codemod ~80 imports, eliminar `DataTable.tsx` re-exports. Verificar build y HMR.
10. **Verificación final + changelog** — `bunx eslint src --max-warnings=0`, `bunx vitest run`, `bunx tsc --noEmit`. Confirmar `rg "eslint-disable" src` devuelve sólo menciones en strings del changelog. Bump `APP_VERSION` a 11.26.0 y entrada en `Changelog.tsx`/`changelogData.ts`/chunk activo (respetando límite 10).

## Riesgos y mitigaciones

- **Cambios de deps en `useEffect`/`useMemo` pueden disparar bucles**: validar manualmente cada caso corriendo el flujo (editar embarque, snapshot auditoría, portal). Tests + smoke en preview.
- **Codemod del DataTable barrel (paso 9)** es el más invasivo; aislarlo en el último paso para no contaminar PRs anteriores. Si rompe HMR/preload se revierte sólo ese loop.
- **Cambios de tipo en `exportListado`** pueden cascadear: trabajar dentro del archivo y mantener API pública intacta.

## Fuera de alcance

- Refactor funcional de hooks (sólo se tocan deps/extracciones puras).
- Reemplazo del sistema de toasts.
- Migración completa de tablas estáticas a `<DataTable />` (sólo las dos `Dimensiones*` quedan documentadas en allowlist).
