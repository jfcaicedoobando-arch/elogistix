# Pendientes de las 2 auditorías de calidad de tests

Resumen de lo que quedó **diferido a propósito** o **no se pudo ejecutar** en `13.115.0` (auditoría 1) y `13.116.0` (auditoría 2). Ordenado por impacto/riesgo.

---

## 🔴 Alto impacto — bugs latentes que ningún test caza hoy

1. **`useEmbarquesListData.test.ts:15-33` redefine `buildLiquidacionMap` internamente**
   El test prueba su propia copia de la función. Si el código real cambia, el test sigue verde. **Pendiente:** importar la función real y matar la copia local.

2. **`facturapi-emitir` no tiene test de auth anónima**
   Usa `SERVICE_ROLE_KEY` y emite CFDIs. Si alguien quita el check de Authorization, cualquiera podría timbrar facturas. **Pendiente:** test estructural tipo `facturapi-cancelar/index_test.ts`.

3. **`proformas/services/facturar.ts:106` — idempotencia parcial USD+MXN**
   Si el update final falla después de timbrar, un retry duplica la factura en Facturapi. **Pendiente:** test de "fallo entre timbrado y update" + posiblemente migrar a transacción o flag de idempotencia.

4. **`tesoreria/services/sugerirCandidatos.ts` — tolerancia ±$1 sin tests de borde**
   Igual que `decidirEstadoFactura` ahora: un cambio de `<=` a `<` rompería la conciliación silenciosa. **Pendiente:** extraer a helper puro + 6-8 tests de borde (exacto, ±$0.99, ±$1.01, cambio de moneda).

5. **`facturacion/services/pagos/index.ts:38` — `registrarPagoFactura` ignora resultado del insert**
   Si la BD falla, el código sigue como si todo bien. **Pendiente:** verificar `error` y test que falle si no se valida.

---

## 🟠 Cobertura crítica que no se hizo en auditoría 2

6. **`embarques/services/pnlFinanciero.ts` — sólo wrapper testeado**
   La RPC `pnl_financiero_embarque` (lógica real en SQL) no tiene tests pgTAP. **Pendiente:** o bien tests pgTAP en `supabase/tests/rls/`, o tests de integración que invoquen la RPC con fixtures.

7. **`facturapi.ts` — responses 402/429 (cuota, rate-limit) no testeadas**
   En producción, un 429 hace que el toast diga "error desconocido". **Pendiente:** tests de cada código de error de Facturapi → mensaje legible al usuario.

8. **`cotizacion/services/bitacoraTarifa.ts` — sin tests**
   Audita cambios de precio. Si rompe, perdemos historial sin saber. **Pendiente:** test de happy path + payload escrito.

9. **`profit/services/estadoResultados.ts` — diferencia cambiaria real no testeada**
   Caso clave: factura emitida con TC=17.5, pago cobrado con TC=18.2. La diferencia debe ir a "Otros ingresos/egresos". Hoy `estadoResultados.test.ts` sólo verifica que se consulten las tablas. **Pendiente:** 3-4 tests con fixtures que ejerciten diferencia cambiaria positiva, negativa, y misma moneda (no aplica).

---

## 🟡 Patrones sistémicos pendientes

10. **`useEmbarqueEstadoActions.test.tsx:86` — verifica toast pero no su mensaje**
    Un error mostrado como éxito sería invisible. **Pendiente:** assertion sobre `getByText` del mensaje real, o pattern `expect(toast).toHaveBeenCalledWith({variant:'destructive', ...})`.

11. **Tests con copy literal en español (`getByText('Guardar cambios')`)**
    Cambiar "Guardar" → "Guardar cambios" rompe tests sin valor. **Pendiente:** sweep para reemplazar por `getByRole('button', { name: /guardar/i })`. Auditoría 1 lo mencionó como Sprint 3, no se ejecutó.

12. **Tests tautológicos `mock.returns(X); expect(result).toBe(X)`**
    Auditoría 1 los identificó pero no los eliminó. **Pendiente:** sweep + delete.

13. **Tests con `new Date()` real (potencial flakiness a medianoche)**
    Sólo `devengadas.test.ts` migró a `vi.useFakeTimers()`. **Pendiente:** auditar resto y crear helper compartido `withFrozenClock(date, fn)`.

14. **Mocks "auto-resolve" en hooks de mutación**
    `mutate` que dispara `onSuccess` sin validar payload. **Pendiente:** aplicar helper `assertUpdatePayload` cuando se identifiquen los hooks reales (los referidos en la auditoría 1 — `usePresupuesto`, `usePlanes` — no existen; hay que volver a buscar los hooks de mutación con tests "blind").

---

## 🟢 Mejoras estructurales (nice-to-have)

15. **Refactor de `_supabaseChainMock`** — explícitamente fuera de scope en auditoría 1, sigue pendiente. Patrón thenable largo y difícil de leer; podría simplificarse.

16. **Invocación real de handlers Deno** — hoy todos los `index_test.ts` de edge functions son grep estructural mejorado. Lo "correcto" sería invocar `Deno.serve` con `Request` mock. Diferido en ambas auditorías por requerir harness no trivial.

17. **Zod schema en `parseVentaRow`** (auditoría 2 lo identificó pero diferido). Hoy hace coerción `Number()` defensiva — riesgo bajo, pero si el shape del JSONB cambia silenciosamente, los conceptos de venta se importan mal sin que ningún test grite.

---

## Propuesta de ejecución

Recomiendo agrupar en **2 sprints** focalizados (no los 3 grandes de antes):

- **Sprint Seguridad/Dinero (4-6h)**: items 1, 2, 3, 4, 5, 9 — todo lo que toca dinero, idempotencia o auth.
- **Sprint Robustez (3-4h)**: items 6, 7, 8, 10, 13 — cobertura de RPCs financieras + flakiness.

Los items 11, 12, 14, 15, 16, 17 son barridos/refactors largos — proponer en una iteración posterior.

**¿Procedo con Sprint Seguridad/Dinero solo, los dos juntos, o un subconjunto específico (dime los números)?**
