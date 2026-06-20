
## Qué pasó

El último push rompió CI. El job agregador marca `quality=failure` y `tests=failure`. Todos los hallazgos vienen de archivos que tocamos al construir la revalidación automática de tarifa (v13.73.x). Ninguno es un bug funcional — son reglas de calidad del proyecto (Power of 10, formatters centralizados, jerarquía de capas, higiene de tests).

## Hallazgos a corregir

### 1. Lint: complejidad ciclomática > 16

| Archivo | Función | Complejidad |
|---|---|---|
| `src/features/cotizacion/components/columnsParts/estadoVigenciaCell.tsx` | `renderEstadoVigencia` | 17 |
| `src/features/embarques/components/OrigenCostosSection.tsx` | `OrigenCostosSection` | 18 |

**Acción:** extraer sub-funciones puras (`getBadgeVariant`, `getEstadoLabel`, helpers de render) hasta dejar cada función ≤ 16.

### 2. Arquitectura — capas Pages→Hooks→Services→Lib

**`src/features/embarques/hooks/useEmbarqueTarifaInfo.ts`** importa `@/integrations/supabase/client` directamente.

**Acción:** mover la consulta a un nuevo `src/features/embarques/services/tarifaInfo.ts` que el hook consuma.

### 3. SAFE-CAST faltantes

**`src/features/embarques/services/reconciliacion3Columnas.ts`** líneas 127 y 139 — casts `as unknown as` sin el marcador requerido.

**Acción:** anteponer `// SAFE-CAST: <razón breve>` a cada uno (ver `mem://principles/safe-cast`).

### 4. Archivo > 200 líneas (Power of 10)

**`src/features/embarques/components/reconciliacion/ReconciliacionTresColumnas.tsx`** — 204 líneas, sin allowlist.

**Acción:** extraer la columna o un subcomponente (`ColumnaCotizado`, `ColumnaReal`, `ColumnaDelta`) a un archivo aparte para bajar a < 200.

### 5. Formatter local redeclarado

**`src/features/cotizacion/components/revalidacion/RevalidarTarifaModal.tsx`** declara `formatMoney` localmente.

**Acción:** importar desde `@/lib/formatters` (el centralizado del proyecto) y eliminar la versión local.

### 6. Test hygiene — títulos duplicados (4 violaciones)

| Archivo | Línea | Título duplicado |
|---|---|---|
| `src/features/admin/services/__tests__/idempotencia.test.ts` | 31 | `"propaga errores de la RPC"` |
| `src/features/cotizacion/services/conversiones/__tests__/embarques.test.ts` | 100 | `"falla si la RPC no devuelve id"` |
| `src/features/cotizacion/services/revalidacion/__tests__/index.test.ts` | 64 | `"propaga error"` |
| `src/lib/domain/__tests__/revalidacionTarifa.test.ts` | 21 | `describe("calcularDeltaPct")` |

**Acción:** renombrar a títulos más específicos en cada uno de los **archivos nuevos** (los que rompieron baseline), no en los preexistentes. Por ejemplo: `"propaga error de revalidarTarifaEnCotizacion"`, `"propaga error de crearVersionEmbarque"`.

## Fuera de alcance

- No tocar lógica de negocio.
- No tocar archivos preexistentes salvo SAFE-CAST en `reconciliacion3Columnas.ts` (mínimo: agregar el comentario marcador).
- No cambiar umbrales (lint, líneas, casts) — corregir el código para cumplirlos.

## Verificación

1. `bun run lint -- --max-warnings 0` → 0 errores, 0 warnings.
2. `bunx vitest run src/__tests__/audit-report.test.ts src/lib/__tests__/architecture.test.ts src/lib/__tests__/architecture-baseline.test.ts src/__tests__/architecture/` → todo verde.
3. Bump `APP_VERSION` → `13.73.2` + entrada en `CHANGELOG.md`: *"Fix: CI verde — corrige lint de complejidad, jerarquía de capas, SAFE-CAST, formatter centralizado y títulos de test duplicados en la feature de revalidación de tarifa."*

## Estimación

7 archivos editados + 1 nuevo (`services/tarifaInfo.ts`) + bump versión + changelog. Cambios pequeños, todos cosméticos/estructurales. Sin riesgo de regresión funcional.
