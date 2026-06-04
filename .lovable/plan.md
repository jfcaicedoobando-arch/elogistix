# Plan: Reubicar `src/lib/ui/` fuera de la capa lib

## Objetivo
Sacar de `src/lib/ui/` los módulos que son puramente de presentación (mapeos visuales, textos, agrupaciones, feedback de UI, reportes de error orientados al usuario) y co-ubicarlos con la capa que los consume, manteniendo `architecture.test.ts` en verde.

## Inventario y destino propuesto

`src/lib/ui/` contiene 14 archivos. Se clasifican así:

### A. Mapeos visuales puros → `src/components/shared/utils/`
Texto, colores, íconos y configuraciones de presentación sin dependencias de lib.

- `uiMappings.ts` → `src/components/shared/utils/uiMappings.ts`
- `kpiTones.ts` → `src/components/shared/utils/kpiTones.ts`
- `estadoConfig.ts` → `src/components/shared/utils/estadoConfig.ts`
- `brand.ts` → `src/components/shared/utils/brand.ts`
- `dialogTokens.ts` → `src/components/shared/utils/dialogTokens.ts`

### B. Feedback / reportes de error orientados al usuario → `src/components/shared/utils/`
Acoplados a UI (toast, diálogos), no a lógica de dominio.

- `appFeedback.ts`
- `errorReport.ts`
- `errorReportFormat.ts`
- `errorDetailsStore.ts`
- `errorDetailsExtract.ts`
- `authSnapshot.ts`
- `authSnapshotBuilder.ts`

Las cadenas internas entre estos archivos (`appFeedback → errorReport → authSnapshot`, etc.) se preservan: todas se mueven al mismo folder, los imports relativos siguen siendo válidos tras renombrar el prefijo `@/lib/ui/` → `@/components/shared/utils/`.

### C. Casos especiales — consumidos por `src/lib/**`

Dos archivos son importados por código que vive en `src/lib/`:

1. `dynamicImportError.ts` → usado por `src/lib/sentry.ts`.
   - **Es una utilidad pura** (heurística sobre mensajes de error), no presentación.
   - **Decisión:** mantener en lib, moverlo a `src/lib/errors/dynamicImportError.ts`. Actualizar import en `sentry.ts` y en los componentes que lo usan.

2. `auditoriaConfig.ts` → usado por `src/lib/domain/auditoriaCsv.ts` (función `reglaShortLabel`).
   - El archivo es claramente de presentación (etiquetas cortas, colores, agrupación visual).
   - **Decisión:** moverlo a `src/components/shared/utils/auditoriaConfig.ts` y refactorizar `auditoriaCsv.ts` para recibir el label como parámetro o duplicar el diccionario mínimo de `reglaShortLabel` dentro de `src/lib/domain/` como dato puro (`auditoriaReglaLabels.ts`). El módulo de UI seguirá re-exportando esa fuente única para componentes.

Resultado: `src/lib/ui/` queda vacío y se elimina la carpeta.

## Tests

- Mover `src/lib/ui/__tests__/*` a:
  - `src/components/shared/utils/__tests__/` para `uiMappings`, `estadoConfig`, `appFeedback`, `errorDetailsExtract`, `errorReportFormat`, `authSnapshotBuilder`.
  - `src/lib/errors/__tests__/dynamicImportError.test.ts` para el caso C.1.
- Actualizar imports dentro de cada test al nuevo path.

## Actualización de imports

Alrededor de 130 archivos consumen `@/lib/ui/*` (hooks, components, pages, contexts, dos archivos en `src/lib/`). Reemplazo masivo con `sed`/`rg --replace`:

- `@/lib/ui/uiMappings` → `@/components/shared/utils/uiMappings`
- `@/lib/ui/kpiTones` → `@/components/shared/utils/kpiTones`
- `@/lib/ui/estadoConfig` → `@/components/shared/utils/estadoConfig`
- `@/lib/ui/brand` → `@/components/shared/utils/brand`
- `@/lib/ui/dialogTokens` → `@/components/shared/utils/dialogTokens`
- `@/lib/ui/appFeedback` → `@/components/shared/utils/appFeedback`
- `@/lib/ui/errorReport` → `@/components/shared/utils/errorReport`
- `@/lib/ui/errorReportFormat` → `@/components/shared/utils/errorReportFormat`
- `@/lib/ui/errorDetailsStore` → `@/components/shared/utils/errorDetailsStore`
- `@/lib/ui/errorDetailsExtract` → `@/components/shared/utils/errorDetailsExtract`
- `@/lib/ui/authSnapshot` → `@/components/shared/utils/authSnapshot`
- `@/lib/ui/authSnapshotBuilder` → `@/components/shared/utils/authSnapshotBuilder`
- `@/lib/ui/auditoriaConfig` → `@/components/shared/utils/auditoriaConfig`
- `@/lib/ui/dynamicImportError` → `@/lib/errors/dynamicImportError`

Se ejecuta un único pasada con `rg -l ... | xargs sed -i` por cada módulo.

## Validación

1. `architecture.test.ts`:
   - `src/lib/**` no importará `@/components` (verificado: solo `sentry.ts` y `auditoriaCsv.ts` tocaban `lib/ui`; el primero pasa a `@/lib/errors/...`, el segundo a un dato local en `src/lib/domain/`).
2. `bunx vitest run src/lib/__tests__/architecture.test.ts` y los tests reubicados.
3. Build automático del harness.

## Changelog y versión

- Bump `APP_VERSION` a `12.53.10`.
- Entrada en `CHANGELOG.md`: "Refactor arquitectónico: `src/lib/ui/` reubicado a `src/components/shared/utils/` (presentación) y `src/lib/errors/` (utilidad de errores). `auditoriaCsv` desacoplado de la capa de UI."

## Fuera de alcance

- Refactor del contenido funcional de los módulos (solo se mueven y reapuntan imports).
- Reorganización adicional de `src/lib/`.
- Cambios en reglas ESLint (`no-restricted-imports`).
