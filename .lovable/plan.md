## Diagnóstico

Los 6 tests fallidos se reducen a 4 problemas reales:

| # | Hallazgo | Causa raíz |
|---|---|---|
| A | `proforma.test.ts > agrupa por expediente` falla | El contrato cambió: `agruparProformasPendientes` agrupa por `embarque_id` (no por expediente). El test fixture usa el mismo `embarque_id: "e1"` para ambas proformas → colapsan en 1 grupo. **No es un bug del código**; el test quedó obsoleto. |
| B | `useDashboardOperador.ts` importa `@/integrations/supabase/client` directo | Viola la regla Pages→Hooks→Services. Las dos queries deben vivir en un service. |
| C | `src/services/embarque/documentos.ts` (214 líneas) | Power-of-10: ≤200. Mezcla helpers de hash + operaciones CRUD. |
| D | `src/components/dashboard/operador/MiOperacionSection.tsx` (209) | Componente con sub-componentes inline (`WidgetCard`, `Row`) + helper `buildPendientes`. |
| E | `src/routes/appRoutes.tsx` (207) | 50 `const X = lazy(...)` + el JSX de rutas en el mismo archivo. |

## Cambios

### 1) Test obsoleto — `src/lib/domain/__tests__/proforma.test.ts`
Actualizar el caso "agrupa por expediente y ordena alfabéticamente" para pasar `embarque_id` distintos por proforma (refleja el contrato real). Sin cambios de lógica.

### 2) Extraer service de operador — `src/services/embarque/dashboardOperador.ts` (nuevo)
- Mover ambos bloques de queries (`fetchDocsFaltantesOperador(email)` y `fetchSinTrackingOperador(email)`) a este service. Exportar tipos `DocsFaltantesItem` y `SinTrackingItem` desde aquí.
- `src/hooks/dashboard/useDashboardOperador.ts` queda como wrapper delgado de `useQuery` (sin import de `supabase`). Re-exporta los tipos para no romper consumidores.

### 3) Partir `services/embarque/documentos.ts`
- Mover `sha256Hex` y `hexToUuid` a `src/services/embarque/documentos/idempotencyHash.ts` (nuevo, ~25 líneas).
- `documentos.ts` importa esos helpers; queda ~190 líneas. Sin cambios de comportamiento.

### 4) Partir `MiOperacionSection.tsx`
- Mover `WidgetCard` y `Row` a `src/components/dashboard/operador/MiOperacionWidgets.tsx` (nuevo).
- Mover `buildPendientes` + `interface Pendiente` a `src/components/dashboard/operador/miOperacionUtils.ts` (nuevo).
- `MiOperacionSection.tsx` queda ~130 líneas, sólo orquesta queries y renderiza las 3 columnas.

### 5) Partir `appRoutes.tsx`
- Mover los 50 `const X = lazy(...)` a `src/routes/appRoutes.lazy.ts` (nuevo). Sin cambios en agrupación; sólo export.
- `appRoutes.tsx` importa desde ahí; queda ~140 líneas de JSX puro.

### 6) Versionado y changelog
- `src/constants/appVersion.ts` → `12.51.17`.
- `CHANGELOG.md` → entrada `## [12.51.17] - 2026-06-04` con un bullet único que cubra los 5 fixes.

## Validación

`bunx vitest run` → 982/982 pasando.

## Fuera de alcance

- No se tocan otras rutas, ni la firma pública de los hooks.
- No se cambia el comportamiento de agrupación de proformas (sólo el test).
- No se renombran columnas, archivos consumidos por imports externos seguirán funcionando vía re-export.
