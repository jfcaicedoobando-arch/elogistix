## Plan — Cierre final auditoría CI/Tests (12.87.0)

Quedan 4 frentes del plan original (`.lovable/plan.md`) sin cerrar. Esta iteración los aborda en un solo PR.

### 1. Migrar los 5 tests inline reales restantes
Tests que mockean `.from(...)` inline y sí caben en `createSupabaseMock`:

- `src/services/dashboard/__tests__/index.test.ts`
- `src/services/search/__tests__/index.test.ts`
- `src/services/cliente-usuarios/__tests__/index.test.ts`
- `src/services/operaciones/__tests__/index.test.ts`
- `src/services/reportes/__tests__/index.test.ts`

Patrón ya establecido en `emisor`/`planes`:
```ts
const { mock } = vi.hoisted(() => ({ mock: { current: null as any } }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() { return mock.current.supabase; },
}));
import { createSupabaseMock } from '@/services/__tests__/_supabaseChainMock';
beforeEach(() => { mock.current = createSupabaseMock(); });
```

Los 12 inline restantes (storage/auth/functions/fetch) quedan documentados como fuera de scope — no se tocan.

### 2. Aplicar fixtures tipadas (item 14 del plan)
Reemplazar `as any` por los builders de `src/test/fixtures/index.ts` en 3 archivos de alto volumen:

- `src/features/embarques/services/__tests__/mutations.test.ts`
- `src/services/cotizacion/mutations/__tests__/update.test.ts`
- `src/services/facturas/__tests__/detail.test.ts`

Meta: reducir los ~75 `as any` originales en ≥30%.

### 3. Sincronizar `setup.ts` con polyfills de Radix (item 16)
Verificar que el polyfill de `IntersectionObserver` exponga `takeRecords()` y que `ResizeObserver` use `vi.fn()` (no función vacía) para permitir `expect(...).toHaveBeenCalled()`. Añadir `localStorage.clear()` + `sessionStorage.clear()` al `afterEach` global si no están.

### 4. Subir umbrales de cobertura (item 18)
Tercer incremento del plan: `lines`/`statements` 35 → 40, `functions` 50 → 55, `branches` 55 → 58. Validar con `bunx vitest run --coverage` que el real siga ≥4 puntos por encima.

### 5. Versionado y changelog
- `APP_VERSION` → `12.87.0`
- Entrada nueva en `CHANGELOG.md` (root) listando los 5 archivos migrados, el conteo de `as any` eliminados, y los nuevos umbrales.

### Detalles técnicos
- No se tocan migraciones SQL, edge functions, ni código de producción.
- Cada test migrado se ejecuta localmente con `bunx vitest run <archivo>` antes de cerrar.
- Si algún test falla tras subir umbrales, se revierte sólo el umbral (no la migración) y se documenta el bloqueo en el changelog.

### Fuera de scope (queda para iteración siguiente)
- Codecov badge en README (requiere `CODECOV_TOKEN` ya configurado).
- Tests para hooks CXC sin cobertura (item 9) — bloque independiente.
- Item 15 (`createWrapper()` por test) en `useEmbarqueForm.test.tsx`.
