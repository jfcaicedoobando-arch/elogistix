# Changelog

Registro de cambios de Libre Carga en formato [Keep a Changelog](https://keepachangelog.com/).
Versionado [SemVer](https://semver.org/). Orden descendente (lo más nuevo arriba).

Para el histórico anterior a `11.21.0` consultar el git history del repositorio
(antes los cambios vivían en `src/content/changelog/`).

## [11.33.0] - 2026-05-25
- **Auditoría calidad — Etapas 1 y 2 (services + components)**: validación arquitectónica de las dos capas restantes. `src/services/**`: 0 imports a `@/hooks`, `@/components`, `@/pages` o `@/contexts` (capa ya limpia), ningún servicio >200 LOC. `src/components/**`: 0 componentes propios usan `useQuery`/`useMutation` directos (todo va vía hook controller), 0 cálculos financieros inline (todo en `lib/financial`). Único archivo >200 líneas es `ui/sidebar.tsx` (shadcn upstream). Guardrails añadidos: bloque ESLint `no-restricted-imports` para `src/services/**` (espejo del que ya existe en `lib/`), y `architecture.test.ts` extendido para cubrir también services. 623/623 tests verdes.

## [11.32.0] - 2026-05-25
- **Auditoría arquitectónica (etapas 7–12)**: `src/generators/*` confirmado como capa fina de adaptadores que delegan en `src/pdf/*` (no hay duplicación real, el split es intencional: `generators/` = API pública para páginas, `pdf/` = composición React-PDF). Eliminados los 9 `as unknown as` en controladores de cliente, proveedor y embarque: `diffFields<T extends object>` ahora acepta entidades tipadas de Supabase directamente y `fields` es `ReadonlyArray<string>`. `detalles?` de `insertBitacora` y `useRegistrarActividad` relajado a `Record<string, unknown>` (el cast a `Json` queda encapsulado en la capa de servicio). Nuevo test `src/lib/__tests__/architecture.test.ts` que verifica que ningún archivo en `src/lib/**` importa `@/hooks`, `@/components` o `@/pages` (red de seguridad ante eliminaciones del ESLint rule). Lint 0/0, 622/622 tests verdes.

## [11.31.0] - 2026-05-25
- **Auditoría arquitectónica (etapas 1–6)**: roto el ciclo `lib/ → hooks/` y `lib/ → components/`. Tipos de dominio (`EmbarqueRow`, `CotizacionRow`, `EmbarqueValidationErrors`, `EntradaBitacora`, `FiltrosBitacora`, `Cliente`, `ContactoCliente`, `NotificacionCliente`, `GlobalSearchResult`, `RentabilidadCliente`, `OperadorBase`, `DesgloseEstados`) movidos a `src/types/*` con re-export desde los hooks/services para preservar la API pública. `lib/jsoncargo/trackingLiveHelpers.ts` ya no depende de `useToast` (usa `AnyToastFn` de `lib/ui/appFeedback`). Nuevo bloque ESLint en `lib/**` que bloquea imports a `@/hooks`, `@/components` y `@/pages`. Creados barrels `lib/financial`, `lib/parsers`, `lib/mappers`. `Papelera`, `Idempotencia` y `SentryDiagnostico` movidos de `pages/dashboard/` a `pages/admin/`. `src/content/` disuelto (`ayudaContent.ts` co-localizado en `pages/dashboard/`). Lint 0/0, typecheck 0/0, 621/621 tests verdes.

## [11.30.1] - 2026-05-25
- **Sentry: silenciado ruido de chunk-load errors**: nuevo `src/lib/ui/dynamicImportError.ts` centraliza la detección. `lib/sentry.ts` filtra estos eventos en `beforeSend` (devuelve `null`). `main.tsx` añade listener global `unhandledrejection` que dispara la misma auto-recarga que ya existe para `vite:preloadError` (cubre el caso de `React.lazy()` cuando Vite no emite preloadError). `ErrorBoundary` reutiliza el helper compartido. Resuelve issue Sentry `JAVASCRIPT-REACT-5` (201 eventos).

## [11.30.0] - 2026-05-25
- **Eliminación del módulo Changelog (UI + chunks TS)**: removidos `src/pages/dashboard/Changelog.tsx`, `ChangelogEntryCard`, `useChangelogController`, `src/content/changelogData.ts`, toda la carpeta `src/content/changelog/` (~9.5k líneas) y `changelog.test.ts`. Sidebar entry, ruta `/changelog`, breadcrumb y link desde Ayuda eliminados. Reemplazado por este único `CHANGELOG.md`. Ahorro estimado ~20% por loop del agente (antes 3 archivos editados por release; ahora 2: `APP_VERSION` + esta entrada). `APP_VERSION` se mantiene como string standalone (lo consumen Sentry, observability, portal y sidebar).

## [11.29.0] - 2026-05-25
- **Wrapper único para Browser Storage (local + session)**: nuevo `src/lib/browserStorage/index.ts` con `safeLocalStorage` / `safeSessionStorage` (guard SSR + try/catch que reporta vía `console.warn` sin propagar `QuotaExceededError` ni errores de modo privado Safari), `getStorageRef('local'|'session')` para librerías que requieren la instancia nativa (TanStack persister), `STORAGE_KEYS` con las 4 claves del proyecto + helper `loginLoggedKey(userId)`, y 3 helpers de alto nivel para el flujo chunk-error reload (`hasChunkReloadBeenAttempted` / `markChunkReloadAttempted` / `clearChunkReloadFlag`). Migrados 6 consumidores: `ThemeContext`, `OrganizationContext`, `lib/queryClient`, `useLoginAudit`, `main.tsx`, `ErrorBoundary`. 633/633 tests verdes (+7).

## [11.28.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 3/3): 0 directivas restantes** (9→0). `no-explicit-any`×4 resueltos con tipos concretos (`Record<string, unknown>`, genérico `<TForm extends FieldValues>`, interfaz `QueryLike`, `Parameters<typeof ...>`). `complexity`×3 con `stripUndefined()` + `withDefaults(props)`. `react-refresh`×1 allowlisted en `eslint.config.js`. `SentryDiagnostico` dividido en 4 subcomponentes. Override de tests añade `no-explicit-any: off`. 626 tests verdes.

## [11.27.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 2): exhaustive-deps complejos** (19→9). `useConceptosForm.inicializarVenta/Costo` → `useCallback`; `useListPageState.defaultFilters` capturado vía `useRef` al montar; `useCotizacionWizardSteps` con `useCallback` y deps reales; `VirtualDataTable.gridTemplate` derivado directamente de `widthsKey` (split/join con sentinel `\\u0001`). 626 tests verdes.

## [11.26.0] - 2026-05-25
- **Eliminación de eslint-disable (parte 1/2)**: 11 directivas removidas (30→19). Tests (`no-console`, `no-control-regex`) movidos a override de config; `Dimensiones*` / `EmbarquesRelacionadosCard` a allowlist; `exhaustive-deps` corregidos por causa raíz en `AuthContext`, `EditarEmbarque`, `DialogBolContainers`, `useAuditoriaSnapshots`, `useEmbarqueEstadoActions`, `usePortalEmbarquesController`. 626 tests verdes.

## [11.25.0] - 2026-05-25
- **Spreads de queryKeys promovidos a factory methods**: 15 spreads `[...queryKeys.X, …]` eliminados. Factory expone métodos tipados (`embarques.full`, `dashboard.statsSummary`, `clientes.selectByOrg`, etc.). 0 spreads fuera de `lib/query`. 626 tests verdes.

## [11.24.0] - 2026-05-25
- **Centralización de query keys (P2)**: 110 literales queryKey migrados a factories en `lib/query` (crm, auditoria, appLogs, facturacion, misc). 44 archivos migrados. Invalidaciones usan el prefijo más amplio (`queryKeys.crm.X.all`, `dashboardAll`). 0 strings hardcodeados de queryKey fuera de `lib/query`. 626 tests verdes.

## [11.23.0] - 2026-05-25
- **P1.6 — Split de god services (cotización + facturas)**: `services/cotizacion/mutations.ts` (137 líneas) → `mutations/` con una operación por archivo + payload builders puros. `services/facturas/proyeccion.ts` (111) y `huecoFacturacion.ts` (165) → carpetas con `fetchSources` (I/O Supabase) + `buildFilas` (agregaciones puras) + `index` (orquestador). API pública intacta vía resolución a `index.ts`. 626 tests verdes.

## [11.22.1] - 2026-05-25
- **Perf tests estabilizados para CI**: `DataTable.perf.test.tsx` con helper `measureMedian` (1 warmup + N mediciones con `cleanup()` + `tryGc()`). Umbrales relativos (5k ≤ baseline1k×8, 10k ≤ baseline1k×15) + rerenders ≤50-60% del mount. 0 flakes en 5 corridas consecutivas. 626 tests verdes.

## [11.22.0] - 2026-05-25
- **Auditoría loop 10 — ESLint a 0 warnings**: resueltos 3 `react-refresh/only-export-components`, 1 `no-empty-object-type` y 5 `unused-disable`. Extraídos `oportunidadesFiltersTypes.ts` y `proveedorTableColumns.tsx`. `ColumnMeta` declara marker readonly opcional. 626 tests verdes.

## [11.21.0] - 2026-05-25
- **Auditoría loop 9 — complexity y exhaustive-deps**: complexity 14→3 (3 mappers planos con disable inline). Helpers extraídos: `buildLeadInsertPayload`, `buildOportunidadInsertPayload`, `buildFromOportunidad`, `isLeadDirty`, `extractErrorDetails`, `parseEmbarqueConProfitRaw`, `forecastBuckets`, `buildAuthSnapshot`, `useSentryInfo`, `useCrmInicioVM`. Barrel nuevo `hooks/sentry`.
