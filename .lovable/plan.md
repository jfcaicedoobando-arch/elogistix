# Plan: corregir bugs en tests de shards 2 y 6

Auditoría con subagentes encontró **1 bug alto, 5 medios, 3 bajos** sobre 92 archivos. Ninguno es la causa raíz garantizada del cuelgue >20 min observado en CI (que sigue siendo sospecha sobre shards de PDF/leak en otros números), pero todos son fuentes plausibles de flakiness y falsos positivos.

## Analogía

Los tests son como recetas. Algunas dicen "deja reposar la masa" pero no ponen alarma (sin `await`), o usan el mismo tazón para varias recetas sin lavarlo (QueryClient compartido), o tienen un temporizador real de 4 min con un límite de cocción de 15 min sin colchón. No siempre se queman, pero un día con horno lento sí.

## Cambios

### Alta — `src/features/cxp/services/__tests__/parseCfdi.test.ts`
- L68–81: el test de retry hace `sleep(1s)+sleep(3s)` reales con `testTimeout = 15_000`. Cero margen.
- **Fix**: usar `vi.useFakeTimers()` + `vi.runAllTimersAsync()` siguiendo el patrón de `fetchWithRetry.test.ts`. Quitar el `15_000` literal del `it()`.

### Media — `src/features/profit/hooks/__tests__/useProfit.test.tsx`
- L67: `act(() => result.current.setFuente('facturas'))` sin `await`. Con React 18 + React Query el `waitFor` siguiente puede esperar hasta 15s.
- **Fix**: `await act(async () => { result.current.setFuente('facturas'); })`.

### Media — `src/features/embarques/hooks/__tests__/useEmbarqueForm.test.tsx`
- L16: `const wrapper = createWrapper()` a nivel módulo → QueryClient compartido y cancelado entre tests por el `afterEach` global.
- **Fix**: mover `createWrapper()` a un `beforeEach` o instanciarlo dentro de cada `renderHook`.

### Media — `src/features/embarques/hooks/__tests__/useEditarEmbarqueWizard.test.tsx`
- L44–49: lee `methods.getValues("clienteId")` síncrono pero la inicialización ocurre en `useEffect`. Falso positivo/negativo según timing.
- **Fix**: envolver en `await waitFor(() => expect(result.current.methods.getValues("clienteId")).toBe("cli-1"))`.

### Media — `src/lib/contexts/auth/__tests__/useAuthProfile.sentry.test.ts`
- L23–26: `flushImport()` con `setTimeout(20ms)` real → frágil en CI.
- L49–58: aserción negativa (`not.toHaveBeenCalled()`) inmediatamente después → falso positivo silencioso.
- `renderHook` sin guardar `unmount` → promesa resolviendo tras fin de test, contamina el siguiente en singleFork.
- **Fix**: usar fake timers + `vi.runAllTimersAsync()`, capturar `unmount` y llamarlo al final de cada test, y reforzar la aserción negativa con un `waitFor` que confirme que la rama de éxito sí ocurrió antes.

### Media — `src/features/embarques/services/tracking/__tests__/index.test.ts`
- L4–11: mock manual de Supabase con sólo 4 métodos encadenados → cualquier método extra revienta como `TypeError: undefined is not a function`.
- **Fix**: reemplazar por `createSupabaseMock` del proyecto (patrón estándar definido en mem://technical/testing-mock-patterns).

### Media — `src/features/catalogos/hooks/__tests__/useTiposContenedor.test.tsx`
- L34: `mutateAsync` fuera de `act()` → warnings y contaminación de QueryClient en singleFork.
- **Fix**: envolver en `await act(async () => { await result.current.agregarTipo.mutateAsync(...); })`.

### Baja — `src/features/comisiones/hooks/__tests__/useComisiones.test.tsx`
- Sin `beforeEach(() => mock.mockReset())`. Frágil.
- **Fix**: agregar reset explícito.

### Baja — `portal.test.ts` y `duplicadoRfc.test.ts`
- Usan `vi.*` sin importarlo (funciona por `globals: true`).
- **Fix**: agregar `vi` al import desde vitest para consistencia.

## Fuera de alcance

- Causa raíz del timeout >20 min en CI no se confirmó aquí. Los guardrails de `13.137.23` (limpieza de blobs + `if: success()`) hacen que el próximo CI apunte al shard culpable. Si vuelve a colgar después de estos fixes, abrir un follow-up enfocado en shards de PDF/`canaries`/`pdfLeak*` que viven en otros shards.

## Versionado y registro

- Bump `APP_VERSION` a `13.137.24` y entrada en `CHANGELOG.md` describiendo cada fix por archivo.

## Validación

- `bun run test:shard -- src/features/cxp/services/__tests__/parseCfdi.test.ts src/features/profit/hooks/__tests__/useProfit.test.tsx src/features/embarques/hooks/__tests__/useEmbarqueForm.test.tsx src/features/embarques/hooks/__tests__/useEditarEmbarqueWizard.test.tsx src/lib/contexts/auth/__tests__/useAuthProfile.sentry.test.ts src/features/embarques/services/tracking/__tests__/index.test.ts src/features/catalogos/hooks/__tests__/useTiposContenedor.test.tsx src/features/comisiones/hooks/__tests__/useComisiones.test.tsx`
- Verificar 0 warnings de `act()` y 0 timeouts.
