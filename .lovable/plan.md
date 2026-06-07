## Objetivo

Reforzar `src/test/setup.ts` con un teardown global más agresivo para eliminar fugas acumulativas (JSDOM, React Query, Supabase realtime, `@react-pdf/renderer`) que provocan OOM cuando la suite corre en un solo `bun test` en vez de 2 shards.

## Cambios (un solo archivo: `src/test/setup.ts`)

### 1. Imports adicionales
- `beforeEach`, `afterAll` además de `afterEach`.
- Sin importar `@react-pdf/renderer` directamente (seguir patrón actual de no forzar carga).

### 2. `afterEach` ampliado
Mantener lo existente y agregar:

- **DOM hard reset**: tras `cleanup()`, limpiar `document.body.innerHTML = ""` y `document.head` de `<style>`/`<link>` inyectados por tests (acumulan nodos con refs circulares en JSDOM).
- **Timers / animation frames**: cancelar `requestAnimationFrame` pendientes (`let id = requestAnimationFrame(()=>{}); while(id--) cancelAnimationFrame(id);`) además de `vi.useRealTimers()`.
- **Supabase realtime**: si el módulo está cargado (`import('@/integrations/supabase/client')` cacheado), llamar `supabase.removeAllChannels()` defensivamente dentro de `try/catch`. Sólo si el módulo ya está en `import.meta` / globalThis para no forzar carga.
- **Event listeners globales**: snapshot de listeners en `beforeEach` sobre `window`/`document` no es viable de forma genérica; en su lugar, exponer un helper opcional y resetear `window.onerror`, `window.onunhandledrejection` a `null`.
- **QueryClient global**: además del `clear()`, llamar `unmount()`/`cancelQueries()` si está disponible (`__TEST_QUERY_CLIENT__.cancelQueries?.()` antes de `clear`).
- **`vi.unstubAllGlobals()` y `vi.unstubAllEnvs()`** para revertir stubs de `globalThis` y `process.env`.
- **`vi.restoreAllMocks()`** NO — rompería los mocks declarados a nivel módulo (ya documentado en setup actual). Sólo `clearAllMocks()`.

### 3. Reset selectivo de módulos pesados
Tras cada archivo de test (no cada `it`), no hay hook nativo `afterFile` en Vitest; sin embargo:

- Llamar `vi.resetModules()` dentro de `afterEach` **rompe** mocks hoisted. Por eso NO se usa global. En su lugar, dejar comentario explícito y, si `global.gc` está disponible (Node con `--expose-gc`), invocarlo aquí (ya tenemos `--max-old-space-size=8192`, agregar `--expose-gc` en `vitest.config.ts` execArgv no es parte de este cambio — solo aprovechar si existe).

### 4. `afterAll` global
- Limpiar caches de `@react-pdf/renderer` (`__REACT_PDF_FONT__`) por última vez.
- `vi.restoreAllMocks()` permitido aquí (fin del archivo, no rompe el siguiente).

### 5. `gc()` opcional
Helper `maybeGc()` invocado al final de `afterEach` y `afterAll`. No-op si `--expose-gc` no está activo.

## Lo que NO se toca

- `vitest.config.ts` (sigue con `singleFork: false`, `maxForks: 1`, `fileParallelism: false`).
- `queryWrapper.tsx`, mocks de Supabase, tests individuales.
- No se agregan dependencias.

## Validación

1. Correr **shard 1/2** y **shard 2/2** por separado — deben seguir verdes (regresión cero).
2. Correr la suite completa en un solo `npx vitest run` con `timeout 600s` y observar heap (`--logHeapUsage`) para confirmar que no crece monotónicamente.
3. Si pasa: actualizar `CHANGELOG.md` + `APP_VERSION` (patch bump) y memoria `mem://technical/testing-cleanup-protocol` con los nuevos pasos del teardown.

## Riesgos

- `removeAllChannels()` sobre supabase real podría fallar si la URL no responde — envuelto en `try/catch`.
- Limpiar `document.body` después de `cleanup()` es redundante pero barato; bajo riesgo.
- `unstubAllGlobals` revierte stubs legítimos: ningún test actual usa `vi.stubGlobal` persistente entre archivos (verificado por convención), seguro.
