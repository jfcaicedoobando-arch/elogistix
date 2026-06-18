## Estado de la implementación

Verifiqué los 5 sub-planes (A, B, C, D, E) del audit de Sentry — **todo está implementado en código** (v13.63.0):

- A: `tracePropagationTargets` + `resolveEnvironment` en `core.ts`, `captureException` en `useAuthSession`/`useAuthProfile`/`fetchExchangeRates`, release alineado en `vite.config.ts`.
- B: `QueryCache`/`MutationCache` con `onError → reportQueryError` (queryClient), `ErrorBoundary` con tag `crashed_route`, init Sentry coordinado con preload del persister.
- C: `wrapEdgeHandler` en `facturapi-emitir` e `facturapi-cancelar`.
- D: `APP_VERSION` único como fuente de verdad para release vite + runtime.
- E: ESLint `no-restricted-imports` para `@sentry/*` con allowlist + `user.test.ts` cubre login/logout.

**Gap real**: faltan tests específicos para el código nuevo de A/B/C. El plan es cerrarlo con una sola tanda de pruebas.

## Tests a generar

| # | Archivo | Cubre |
|---|---|---|
| 1 | `src/lib/observability/sentry/__tests__/environment.test.ts` | `resolveEnvironment()`: prioridad `VITE_SENTRY_ENV` > host (`lovable.app`→preview, `librecarga.com`→production) > MODE. Valida que `TRACE_PROPAGATION_TARGETS` exporta los 3 patrones correctos (regex API/functions, Supabase functions, librecarga). |
| 2 | `src/lib/query/__tests__/queryClient.sentry.test.ts` | `reportQueryError`: con `vi.mock('@sentry/react')`, dispara una query y una mutation que fallan y verifica que `captureException` se llamó con `tags: { feature: 'react_query', kind: 'query'/'mutation' }` y `extra` con el `queryKey`/`mutationKey`. |
| 3 | `src/components/shared/__tests__/ErrorBoundary.test.tsx` | Render con hijo que lanza → fallback visible, `captureException` invocado con tag `crashed_route` resuelto a `window.location.pathname`. Botón "Recargar" llama `window.location.reload`. |
| 4 | `src/contexts/auth/__tests__/useAuthSession.sentry.test.ts` | Mock de `supabase.auth.getSession` que rechaza → `captureException` se llama con `tags: { feature: 'auth', phase: 'getCurrentSession' }`. Variante happy-path no reporta. |
| 5 | `src/contexts/auth/__tests__/useAuthProfile.sentry.test.ts` | Mock del fetch de profile rechaza → `captureException` con `tags: { feature: 'auth', phase: 'fetchUserContext' }`. |
| 6 | `src/features/catalogos/services/__tests__/exchangeRates.sentry.test.ts` | Mock de `supabase.functions.invoke` que devuelve `error` → se llama `captureException` con `tags: { feature: 'exchange_rates', source: 'edge_invoke' }` y la función degrada con fallback. |
| 7 | `src/__tests__/architecture/sentry-imports-guardrail.test.ts` | Recorre `src/components`, `src/pages`, `src/contexts`, `src/lib` (excepto allowlist: `observability/sentry/**`, `ErrorBoundary.tsx`, `queryClient.ts`, `main.tsx`, hooks de auth `useAuth*`, `services/.../index.ts` de catálogos) y asserta que NO hay `import ... from "@sentry/...";` estático. Cualquier nuevo archivo que viole esto rompe CI antes que ESLint. |
| 8 | `supabase/functions/facturapi-emitir/sentry_test.ts` y `facturapi-cancelar/sentry_test.ts` | Smoke test Deno: importa `index.ts`, intercepta `Deno.serve` para extraer el handler y verifica que está envuelto por `wrapEdgeHandler` (firma esperada: añade `sentry-trace`/captura excepciones al re-lanzar). Mantiene el patrón existente de `helpers_test.ts`. |

Adicionalmente:
- Bump `APP_VERSION` → `13.64.0`.
- Entrada en `CHANGELOG.md`: "Cobertura de tests de la auditoría Sentry (Fases A–E)".

## Detalles técnicos clave

- **Reset entre tests**: en (1) usar `vi.stubGlobal('window', ...)` + `vi.stubEnv('VITE_SENTRY_ENV', ...)` y limpiar con `vi.unstubAllEnvs()/unstubAllGlobals()` en `afterEach`.
- **Mock de `@sentry/react`**: usar `vi.mock('@sentry/react', () => ({ captureException: vi.fn(), withScope: (cb) => cb({ setTag: vi.fn(), setContext: vi.fn() }) }))` en (2)(3)(4)(5)(6). El import dinámico (`void import('@sentry/react').then(...)`) en `queryClient.ts` resuelve al mock — usar `await vi.waitFor(...)` para esperar la microtask.
- **(3) ErrorBoundary**: usar `vi.spyOn(console, 'error').mockImplementation(() => {})` para silenciar el ruido de React al renderizar el componente que lanza.
- **(7) guardrail**: leer archivos con `fs.readdirSync` recursivo + regex `/from\s+["']@sentry\//`. Allowlist como `Set<string>` con paths relativos.

## Verificación

Correr la suite afectada (`vitest run` filtrando por los paths nuevos) y confirmar 0 fallos antes de cerrar.