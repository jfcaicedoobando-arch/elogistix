# Plan: Auditoría línea por línea del shard 6/12

## Contexto

El shard 2 ya fue auditado en la versión `13.137.25` y se aplicaron varios fixes (act async, fake timers, stubGlobal). Sin embargo el CI sigue cayendo por timeout, y los logs muestran que el shard 6/12 también excede los 20 minutos. Como `singleFork: true` corre todos los archivos en un solo proceso de Node, basta con que **un solo archivo** filtre timers, listeners, promesas o módulos para colgar todo el shard.

Hay que revisar los **45 archivos** de shard 6 línea por línea, sin correr el shard (ya confirmamos que reproducirlo localmente es lento e inestable).

## Estrategia

Dividir los 45 archivos en 4 lotes de ~11 archivos. Lanzar **4 subagentes en paralelo** con instrucciones idénticas. Cada subagente lee cada archivo de su lote completo y reporta hallazgos clasificados por severidad.

### Patrones a buscar (mismos que shard 2)

1. **Timers sin limpiar**: `setInterval`, `setTimeout`, `vi.useFakeTimers()` sin `useRealTimers()` en cleanup, o fake timers en `beforeAll`/`afterAll` (deben ir en `beforeEach`/`afterEach`).
2. **Promesas sin resolver / `act` síncrono envolviendo async**: `act(() => mutateAsync())`, `act(() => trigger())`, `act(() => router.push())` — todo lo async requiere `await act(async () => ...)`.
3. **Globals mutados sin `vi.stubGlobal`**: asignaciones directas a `global.fetch`, `navigator.clipboard`, `window.location`, `document.cookie` sin restauración.
4. **Listeners sin remover**: `addEventListener`, `subscribe`, `EventTarget`, observers (`ResizeObserver`, `IntersectionObserver`) sin cleanup.
5. **Canales/realtime Supabase**: mocks que no llaman `removeChannel`/`unsubscribe`.
6. **React Query / QueryClient compartido entre tests** (no `new QueryClient()` por test).
7. **Imports dinámicos (`await import(...)`) dentro de tests** sin reset de módulos, que dejan cache.
8. **PDF / `@react-pdf/renderer`**: renders sin `unmount`/cleanup explícito (riesgo de leak ya documentado).
9. **`waitFor` con timeout custom alto** o sin assertion fuerte.
10. **`it.only` / `describe.only` / tests skippeados accidentalmente**.
11. **Mocks de Supabase sin `mockReset`** entre tests.
12. **Loops `for`/`while` sin condición de salida clara** o creando muchas promesas.

### Lotes

- **Lote A (11)**: `architecture/fase2-pages-and-formatters` → `comisiones/devengadas`
- **Lote B (11)**: `costeo/demorasVenta.extra` → `embarques/cotizacionVinculadaContext`
- **Lote C (11)**: `embarques/embarque.extra` → `facturacion/pagos/pagos`
- **Lote D (12)**: `portal/usePortalDocumentDownload` → `pdf/theme/stylesLayout`

### Formato de reporte por subagente

Por cada hallazgo:

```
ARCHIVO: <ruta>
LÍNEA: <número>
SEVERIDAD: ALTA | MEDIA | BAJA
PATRÓN: <uno de los 12>
DESCRIPCIÓN: <1 línea>
FIX SUGERIDO: <1-2 líneas>
```

Si un archivo está limpio: `ARCHIVO: <ruta> — OK`.

## Entregable

Tras consolidar los 4 reportes, aplicaré los fixes ALTA y MEDIA en una sola pasada, agregaré la instrumentación `[shard-trace]` si no está activa, bumpeo de versión + entrada en `CHANGELOG.md`.

## Detalles técnicos

- No correr `vitest --shard=6/12`. Auditoría puramente estática.
- Los subagentes son read-only; sólo yo aplicaré edits en build mode.
- Si un patrón aparece >3 veces en distintos archivos, considerar moverlo al setup global (`src/test/setup.ts`).
