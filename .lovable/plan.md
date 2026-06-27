## Auditoría de cleanup E2E

Revisé los 12 specs, `fixtures/cleanup.ts`, `fixtures/api.ts` y los contratos reales de las RPC/tablas que tocamos. La mayoría está bien (specs 01-07 son read-only y no necesitan cleanup), pero **6 hallazgos** reales en los specs mutadores (08-12) y en los helpers.

### Hallazgos

| # | Spec / helper | Severidad | Problema |
|---|---|---|---|
| 1 | **09-cierre-embarque** | Alta | Llama `supabaseRest(page).rpc("reabrir_embarque", { p_embarque_id })` pero la firma real es `reabrir_embarque(p_embarque_id uuid, p_motivo text)` (NOT NULL). El RPC tira 4xx, `bestEffortCleanup` lo traga y el embarque queda **cerrado** para siempre. |
| 2 | **09-cierre-embarque** | Alta | El cleanup vive dentro del `test("admin_org puede cerrar…")`. Si el spec falla **después** del clic de cerrar pero antes del bloque cleanup (p. ej. al esperar el badge "cerrado"), el embarque queda cerrado sin reapertura. Debe moverse a un `afterEach` con flag `wasClosed`. |
| 3 | **10-auditoria-bulk** | Media | Inserta filas en `auditoria_revisiones` (3 por corrida) y **no las borra**. Tras varios runs se acumula ruido y baja el score de auditoría real. Falta `afterEach` que borre `auditoria_revisiones` por `comentario ILIKE 'E2E_TEST%'` y/o por `created_at > startTs`. El snooze también puede insertar — borrar `auditoria_snooze` con la misma heurística. |
| 4 | **11-cotizacion-a-embarque** | Media | `DELETE FROM embarques WHERE id=…` directo puede fallar por FK (contenedores, tracking_eventos, embarque_conceptos generados por el RPC), o por trigger `bloquear_*`. El error se traga y queda un embarque huérfano. Debe usar una RPC dedicada (`eliminar_embarque_borrador` si existe) o borrar primero las tablas hijas en orden, dentro de `bestEffortCleanup` separados. También: marcar el embarque con `notas_internas = 'E2E_TEST'` justo después de crearlo para que aparezca en reportes de basura. |
| 5 | **12-cxp-factura-pago** | Alta | `test.afterAll` abre un context nuevo con `storageState: "e2e/.auth/internal.json"`. Si ese storageState no se generó (globalSetup falló) o el access_token expiró, `supabaseRest` tira "no se pudo obtener handle" y **no limpia nada**. Debe: (a) si falla la lectura del handle, hacer fallback a `loginAs(page, internalCreds())`; (b) loguear con `testInfo.attach` en lugar de `console.warn` invisible. |
| 6 | **12-cxp-factura-pago** | Media | Sólo borra `pagos_proveedor` + `proveedor_facturas`. No borra `proveedor_facturas_conceptos` (CASCADE lo cubre por FK) pero **sí queda** el folio `FP-XXXXXX` consumido del consecutivo (no es recuperable, sólo documentar). Además, si el primer test inserta y el segundo falla a la mitad, no hay registro de `bitacora_actividad` para localizar la basura — falta tag `referencia LIKE 'E2E_TEST%'` ya está ✓, pero confirmar que se borre por ese tag como red de seguridad. |
| 7 | **08-flujo-fiscal** | Media (sandbox) | **Cero cleanup**. Cada corrida crea factura timbrada + pago + REP en FacturApi sandbox y los deja vivos. Está `skip` por defecto, pero cuando se corre manualmente acumula CFDI. Cancelar CFDI no es trivial (motivo SAT 02 "sin sustitución" funciona en sandbox); al menos invocar `cancelar_factura` con motivo 02 en `afterAll` best-effort + borrar `pagos_factura` locales. |
| 8 | **fixtures/cleanup.ts** | Baja | `console.warn` no se ve en el reporter por defecto. Cambiar la firma a `bestEffortCleanup(testInfo, label, fn)` y usar `testInfo.attach("cleanup-warning", { body: msg, contentType: "text/plain" })` para que aparezca en el HTML report. |
| 9 | **fixtures/api.ts** | Baja | `readHandle` falla silencioso si no hay sesión; útil añadir un `Page` argument check + mensaje claro. También: cachear el handle por test para no leer localStorage en cada call. |
| 10 | **Global** | Baja | No hay `globalTeardown` que detecte huérfanos. Añadir uno mínimo que loguee (no borre) filas con `referencia/comentario/notas_internas LIKE 'E2E_TEST%'` para visibilidad. |

### Fixes propuestos (orden de implementación)

1. **Spec 09** — pasar `p_motivo: "cleanup E2E"` a la RPC y mover cleanup a `test.afterEach` con flag `wasClosed`.
2. **Spec 11** — añadir intento de cleanup en cascada: `tracking_eventos` → `embarque_contenedores` → `embarque_conceptos` → `embarques`, cada uno en su propio `bestEffortCleanup`. Marcar el embarque con `notas_internas = 'E2E_TEST'` tras el `waitForURL`.
3. **Spec 12** — endurecer `afterAll`: try `loginAs` fallback si el storageState no produce token; añadir cleanup defensivo por tag (`referencia ILIKE 'E2E_TEST%'`) además del id.
4. **Spec 10** — capturar `startTs = new Date().toISOString()` en `beforeEach`; `afterEach` borra `auditoria_revisiones` y `auditoria_snooze` del usuario E2E con `created_at >= startTs` o `comentario ILIKE 'E2E_TEST%'`.
5. **Spec 08** — opcional, sólo cuando esté `E2E_FISCAL=1`: `afterAll` intenta cancelar CFDI motivo 02 (best-effort) y borra `pagos_factura` locales tagueados.
6. **Helpers** — `bestEffortCleanup` acepta `testInfo` y usa `attach` para visibilidad; `supabaseRest` mensaje de error claro cuando no hay token.
7. **globalTeardown** (nuevo, ~30 líneas) — query read-only que cuenta huérfanos `E2E_TEST` y los reporta en stdout para que un humano limpie manualmente si hace falta.

### Notas técnicas

- `bestEffortCleanup` se mantiene "no rompe el test"; sólo mejora visibilidad.
- Ningún cambio en `src/`. Todo vive en `e2e/`, `playwright.config.ts` y `CHANGELOG.md`.
- Bump de versión sugerido: `13.139.10` (patch dentro del ciclo de mejoras E2E).

### Out of scope

- Reescribir specs read-only (01-07) — no aplica.
- Crear seeds automáticos para los specs gateados (`E2E_*`) — eso es otro plan.
- Cancelar CFDIs reales en producción — sólo sandbox.

¿Implemento los 7 fixes o sólo los de severidad Alta (1, 2, 5)?
