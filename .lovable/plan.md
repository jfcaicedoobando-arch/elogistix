## 🔍 Auditoría CI & Tests — Libre Carga

Resultado consolidado de tres auditorías paralelas: CI/CD, cobertura, y patrones técnicos.

---

## Estado actual (resumen)

**Lo sólido ✅**
- CI corre en cada PR y push a `main` (`.github/workflows/ci.yml`) con sharding en 16 jobs paralelos.
- Smoke tests diarios en producción (`post-deploy-smoke.yml`).
- 296 archivos de test, infraestructura Vitest nivel senior (forks, isolate, GC explícito, alias PDF stub).
- 11 tests Deno escritos para Edge Functions.
- Setup global con cleanup riguroso (RTL, fake timers, PDF font cache, QueryClient).
- `lib/financial/` y `features/embarques/` con cobertura sólida (~70-85%).

**Lo crítico 🔴**
1. **No hay `tsc --noEmit` en CI** → errores de tipos pueden llegar a `main` (SWC no chequea tipos).
2. **Los 11 tests Deno nunca se ejecutan** en el pipeline.
3. **No hay pre-commit hooks** (Husky/Lefthook ausentes).
4. **0 tests de aislamiento multi-tenant / RLS** — nadie verifica `eq("organization_id", ...)`.
5. **0% cobertura en `pages/` y ~1.5% en `components/`** (329 componentes → 5 tests).
6. **`services/cotizacion/conversiones/` y `parseCfdi.ts` sin tests** (workflows de no-retorno + parseo fiscal).
7. **Sin PDF leak canary** pese a infraestructura preparada para él.
8. **Umbrales de cobertura simbólicos** (lines 25%, statements 25%).
9. **6 archivos duplican mocks de Supabase inline** ignorando `_supabaseChainMock`.
10. **75 ocurrencias de `as any` en tests** por falta de fixtures tipadas.

---

## Plan de remediación

Tres fases ordenadas por ROI (impacto/esfuerzo).

### 🟥 Fase 1 — Red de seguridad básica (1-2 días)

Objetivo: cerrar agujeros que permiten que código roto llegue a `main`.

1. **Agregar typecheck a CI**
   - `package.json`: añadir `"typecheck": "tsc --noEmit"`.
   - `ci.yml` job `quality`: paso `bun run typecheck` antes de build.

2. **Habilitar tests Deno en CI**
   - Nuevo job `edge-functions` con `denoland/setup-deno@v2`.
   - Comando: `deno test supabase/functions/**/*_test.ts --allow-env --allow-net`.

3. **Pre-commit con Lefthook**
   - Instalar `lefthook` (devDep) + `lefthook.yml`.
   - Hook pre-commit: `eslint --fix` + `tsc --noEmit` sobre staged.
   - Hook pre-push: `bun run test:shard` (1 shard rápido) o `vitest run --changed`.

4. **Pinear versiones de Actions**
   - `actions/checkout@v4`, `upload-artifact@v4`, `download-artifact@v4`.
   - `setup-bun` con `bun-version: "1.x"`.

5. **Mover anon key a secret de repo**
   - `post-deploy-smoke.yml`: usar `${{ secrets.VITE_SUPABASE_ANON_KEY }}`.

### 🟧 Fase 2 — Cobertura de lo crítico (3-5 días)

Objetivo: testear los puntos de no-retorno del negocio.

6. **Tests de aislamiento multi-tenant**
   - Pattern: usar `_supabaseChainMock.tableCalls` para assertear `.eq("organization_id", ...)` en cada servicio CXP, CXC, embarques, cotizaciones, clientes.
   - Crear `src/test/helpers/assertOrgScoped.ts`.

7. **`services/cotizacion/conversiones/`** — tests para los 5 archivos (embarques, portal, prospecto, helpers): conversiones cotización→embarque/cliente.

8. **`services/cxp/parseCfdi.ts`** — tests de parsing CFDI: XML malformado, RFC faltante, caracteres especiales, namespaces.

9. **Hooks CXC sin cobertura**: `useCobranza`, `useFacturas`, `useNotasCredito`, `useFacturacionPageController`.

10. **PDF leak canary**
    - `src/test/canaries/pdfLeak.test.tsx`: 200 renders de un documento PDF representativo, verificar drift de heap < 50MB con `--expose-gc`.
    - Excluir del shard normal; correr en job dedicado nocturno.

11. **Reemplazar tests "ToBeDefined"** en `services/cxp/__tests__/index.test.ts` por integración real.

12. **Corregir test de fallback `useTasaIVA`** (usar `def` distinto del valor del mock).

### 🟨 Fase 3 — Calidad sostenida (5-7 días)

Objetivo: que la suite escale sin acumular deuda.

13. **Centralizar mocks de Supabase**
    - Migrar los 6 archivos con mocks inline al helper `_supabaseChainMock`.
    - Tipar el helper con genéricos: `createSupabaseMock<T>(data, error?)`.

14. **Factories de fixtures tipadas** — `src/test/fixtures/{cotizacion,embarque,proforma,factura,cliente}.ts` con builders `makeX(overrides?)`. Reemplazar progresivamente los 75 `as any`.

15. **`createWrapper()` a nivel de test** (no de módulo) en `useEmbarqueForm.test.tsx` y similares — usar `beforeEach`.

16. **Polyfills globales en `setup.ts`**: `ResizeObserver`, `IntersectionObserver`, `localStorage.clear()` en afterEach.

17. **Reporter JUnit + Codecov**
    - Vitest reporter `junit` con `outputFile=test-results.xml`.
    - `codecov/codecov-action@v4` consumiendo `coverage/lcov.info`.

18. **Subir umbrales gradualmente** — plan de 5 puntos por sprint hasta 60/60/65/70.

19. **Smoke tests de las 4 Edge Functions sin tests** — `cxc-recordatorios`, `demo-access`, `process-email-queue`, `sentry-tunnel`.

---

## Detalles técnicos clave

### Estructura propuesta `lefthook.yml`
```yaml
pre-commit:
  parallel: true
  commands:
    eslint:
      glob: "*.{ts,tsx}"
      run: bun x eslint --fix {staged_files}
      stage_fixed: true
    typecheck:
      run: bun x tsc --noEmit
pre-push:
  commands:
    test:
      run: bun run vitest related --run {push_files}
```

### Job CI para Deno
```yaml
edge-functions:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: denoland/setup-deno@v2
      with: { deno-version: v2.x }
    - run: deno test supabase/functions/**/*_test.ts --allow-env --allow-net
```

### Helper de aislamiento multi-tenant
```ts
// src/test/helpers/assertOrgScoped.ts
export function assertOrgScoped(mock: SupabaseChainMock, table: string, orgId: string) {
  const call = mock.tableCalls.find(c => c.table === table);
  expect(call?.eq).toContainEqual(["organization_id", orgId]);
}
```

---

## Lo que NO entra en este plan

- Tests E2E (Playwright/Cypress) — fuera de scope; CI actual es 100% unit/integration.
- Reescritura de tests existentes que ya funcionan.
- Migración a otra herramienta de test (Vitest se queda).
- Tests visuales (Chromatic / Percy).

---

## Versionado y entregables

Cada fase actualiza `APP_VERSION` y `CHANGELOG.md` con entrada propia. Fase 1 = `12.82.0`, Fase 2 = `12.83.0`, Fase 3 = `12.84.0`.

¿Quieres que arranque con **Fase 1 completa** (typecheck CI + Deno CI + Lefthook + pinear actions + secret de anon key), o prefieres elegir un subconjunto?
