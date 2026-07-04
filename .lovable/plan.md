
## Diagnóstico: cobertura Sentry actual

Analogía: el sistema tiene "cámaras de seguridad" (Sentry) en 3 capas — edge functions (backend), servicios frontend, y hooks/UI. Después de auditar, la cobertura está **muy sólida** con 4 tests de arquitectura que la vigilan automáticamente. Detecté 2 huecos menores, ambos intencionales pero que conviene documentar y/o cerrar.

### 1. Edge Functions (backend) — 30 de 32 con Sentry ✅

| Estado | Cantidad | Cómo |
|---|---|---|
| `wrapEdgeHandler` (automático) | 21 | Auto-captura en cualquier throw. Test: `sentry-edge-wrapping.test.ts` |
| Manual (`initSentryEdge` + `captureEdgeException`) | 9 | Handlers con lógica ad-hoc. Test: `sentry-edge-coverage.test.ts` |
| Exento intencional | 2 | `sentry-tunnel` (es el proxy que **manda** eventos a Sentry — no puede reportarse a sí mismo) y `facturapi-test-conexion` (prueba de conectividad, no lógica de negocio) |

**Blindaje automático:** el test `sentry-edge-coverage.test.ts` **falla el CI** si alguien añade una edge function nueva y no la registra en `MANUAL_COVERAGE`, `WRAPPED_COVERAGE` o la lista `SENTRY_EXEMPT`.

### 2. Servicios frontend fiscales — 100% ✅

El test `sentry-fiscal-services.test.ts` recorre **todos** los archivos `.ts` de `src/features/facturacion/services/` y exige que ningún `catch` "trague" errores: o se re-lanza (React Query los recoge) o se llama `reportCaughtError` / `captureException`. **24 archivos verificados, 0 huecos.**

### 3. Hooks/UI (React) — `notifyError` en 227 archivos ✅

El wrapper `notifyError` (que reporta a Sentry además de mostrar toast) está usado en 227 archivos. El test de arquitectura `error-toasts-use-notifyError.test.ts` prohíbe `toast.error(...)` directo en features nuevas.

Además `reportCaughtError` (para errores en effects/handlers no-mutation) se usa en 20 archivos.

### 4. Huecos detectados (código nuevo)

**Hueco A · `src/features/auditoria/hooks/useBitacora.ts`** — El `onError` registra el fallo solo con `logger.warn` (línea 52-54), sin `reportCaughtError`. Comentario: "Bitácora es background; un toast por cada acción sería ruido". El razonamiento es correcto (no molestar al usuario), pero *sí* queremos que Sentry lo vea para detectar cuando la bitácora está caída silenciosamente.

**Hueco B · `src/features/auditoria/hooks/useAuditoriaSnapshots.ts`** — mismo patrón en 2 mutaciones (líneas 42 y 58): no importa `notifyError` ni `reportCaughtError`.

**Hueco C · `src/features/proformas/services/crud.ts`** — línea 62: `catch { /* best-effort */ }` completamente silencioso en una operación auxiliar. No lo reporta ningún test porque `sentry-fiscal-services.test.ts` cubre `facturacion/services`, no `proformas/services`. Es un `catch` intencionalmente best-effort, pero al menos debería loguear a Sentry con severidad `warning`.

### 5. Flujos "viejos" (pre-13.100)

Todo el módulo pre-fiscal (embarques, cotizaciones, clientes, portal) ya pasó por auditorías previas (`.lovable/audit-todos.md`) y usa `notifyError` en 227 archivos. **No detecté regresiones** ni `try/catch` silencioso en el barrido.

---

## Plan de acción (mínimo, defensivo)

### Cambios propuestos

1. **`useBitacora.ts`** — reemplazar `logger.warn(...)` por `reportCaughtError(err, { method: "USE_REGISTRAR_ACTIVIDAD", severity: "warning" })`. Mantiene el silencio hacia el usuario, pero Sentry ve las bitácoras caídas.
2. **`useAuditoriaSnapshots.ts`** — mismo tratamiento en las 2 mutaciones (`severity: "warning"`, sin toast).
3. **`proformas/services/crud.ts`** línea 62 — cambiar `catch { /* best-effort */ }` por `catch (err) { reportCaughtError(err, { method: "PROFORMA_CRUD_BEST_EFFORT", severity: "warning" }); }`.
4. **Extender `sentry-fiscal-services.test.ts`** (o crear un test hermano) para cubrir también `src/features/proformas/services/`, `src/features/compras/services/` y `src/features/cotizaciones/services/`. Analogía: "poner cámaras en los cuartos que aún no tenían".

### Fuera de alcance
- No se toca `sentry-tunnel` ni `facturapi-test-conexion` (exentos justificados).
- No se cambia comportamiento de UI: los usuarios no verán toasts nuevos; solo Sentry recibe más señales.

### Version bump y changelog
- `APP_VERSION` → `13.171.1` (patch: solo instrumentación).
- Entrada en `CHANGELOG.md`: "Cerrados 3 huecos silenciosos de reporte a Sentry (bitácora, snapshots de auditoría, crud auxiliar de proformas). Test de arquitectura extendido a proformas/compras/cotizaciones."

### Verificación
1. `bunx vitest run src/__tests__/architecture/sentry-*.test.ts` → 56+ tests en verde (ahora incluyen proformas).
2. Simular un fallo en bitácora → aparece en Sentry como `warning`, sin toast en UI.

¿Aplico este plan?
