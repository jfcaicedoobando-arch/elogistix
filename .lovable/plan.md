
# Auditoría de toasts — cobertura 100% + "Ver detalles" universal

## Estado actual (verificado)

| Tipo | Call sites | ¿Tiene "Ver detalles"? |
|---|---|---|
| `notifyError` | 422 | ✅ Sí (persistente + copia reporte) |
| `notifySuccess` | 154 | ❌ No |
| `notifyWarning` | 6 | ❌ No |
| `toast.success` directo | 74 | ❌ No |
| `toast.warning` directo | 12 | ❌ No |
| `toast.info` / `toast(...)` | 45 | ❌ No |
| `crmToast.success/info/undo` | ~30 | ❌ No |
| `toast.error` en `queryClient` | 1 | ❌ No (excluido en allowlist) |

Los guardrails de arquitectura (`error-toasts-use-notifyError.test.ts`) ya impiden `toast.error(...)` directo y `variant:"destructive"`, pero **no existe** un guardrail equivalente para success/warning/info.

## Objetivo

1. **100% de los toasts** — cualquier severidad — pueden abrir "Ver detalles" con reporte copiable (título, timestamp, ruta, usuario, error real si lo hay, contexto).
2. **Cerrar huecos**: queryClient, crmToast, catch silenciosos, comportamiento dentro de modales.
3. **Guardrail arquitectónico** que impida regresiones futuras.

## Cambios

### 1 · `appFeedback.ts` — extender helpers con debug opcional

- `notifySuccess(_, opts)` y `notifyWarning(_, opts)` reciben ahora `error?`, `context?`, `method?`, `payload?`, `requestId?` igual que `notifyError`.
- Cuando se pase cualquiera de esos campos (o siempre, según config), el toast incluye acción **"Ver detalles"** que abre `ErrorDetailsDialog` con el `buildErrorReport`.
- Nuevo helper interno `attachDebugAction(opts)` reutilizado por los 3 notifiers.
- Los notifiers también aceptan `showDetails?: boolean` para forzar la acción incluso sin `error` (ej. éxitos con payload interesante como "Factura timbrada" → ver UUID, folio, sello).
- Éxito y warning **no** son persistentes (duration por defecto), sólo el error mantiene `duration: Infinity`.

### 2 · Nuevo helper `notifyInfo` + migración de `toast(...)` plano

- Añadir `notifyInfo(_, opts)` con la misma firma.
- Migrar los 37 usos de `toast(...)` plano y 8 de `toast.info(...)` a `notifyInfo`.
- Migrar los 74 `toast.success(...)` y 12 `toast.warning(...)` a `notifySuccess` / `notifyWarning` (edits mecánicos por archivo).

### 3 · `queryClient.ts` — reemplazar `toast.error` por `notifyError`

- Sustituir el `toast.error("No pudimos cargar la información", …)` por `notifyError` con `error: err`, `method: "QUERY_CACHE"`, `context: { queryKey }`. Mantener `id` dedupe por root usando la key de sonner (pasar `toastId` a través de options extendidas).
- Quitar `queryClient.ts` del `ALLOWLIST` en el test de guardrail.

### 4 · `crmToast.ts` — trazabilidad opcional

- `success(msg, opts?)` e `info(msg, opts?)` aceptan `{ error?, context?, method? }`. Si se pasa, incluyen "Ver detalles"; si no, se mantienen minimalistas (2s).
- Documentar en el comment head que ahora sí pueden llevar debug.

### 5 · Catch silenciosos → notifyError

- Rastrear con `rg "console\.error\(" src -t ts` los bloques `catch` que no emiten toast (fuera de servicios puros y de `reportCaughtError`).
- Priorizar hooks/mutations/handlers de UI. Convertir a `notifyError(toast, { error, method: "..." })` conservando el `console.error` sólo cuando el helper ya lo cubra vía Sentry.
- No tocar servicios de dominio puros ni tests.

### 6 · Toasts dentro de modales (Dialog)

- Verificar en `src/components/ui/dialog.tsx` que el overlay no captura pointer-events sobre el contenedor `<Toaster>`.
- Añadir `pointer-events-auto` explícito al toast en `sonner.tsx` y `z-index` superior al Dialog (`z-[100]` vs `z-50` del overlay Radix).
- Probar manualmente que "Ver detalles" abre el `ErrorDetailsDialog` **encima** del Dialog abierto (el store ya renderiza a portal root, sólo hay que confirmar z-index).

### 7 · Nuevo guardrail arquitectónico

Nuevo test `src/__tests__/architecture/all-toasts-use-notify-helpers.test.ts` que prohíbe en `src/features/**` y `src/hooks/**`:

- `toast.success(`, `toast.warning(`, `toast.info(`
- `toast(` como statement (no como identifier)

Allowlist mínima: shims (`useToast.ts`, `crmToast.ts`, `appFeedback.ts`, `sonner.tsx`) y tests.

### 8 · Changelog + versión

- Bump `APP_VERSION` a `13.308.7`.
- Entrada en `CHANGELOG.md` describiendo la unificación y el nuevo guardrail.

## Detalles técnicos

- El `ErrorDetailsDialog` ya soporta payloads sin `error` real — muestra "Sin stack trace" y copia el resto del reporte. No requiere cambios.
- `buildErrorReport` ya tolera `error: undefined`.
- Los ~250 call sites de `toast.success/warning/info` se migran con búsqueda-reemplazo por archivo (paso incremental, no en un solo write masivo).
- No hay cambios de backend ni migraciones SQL.

## Riesgos

- **Ruido visual** con "Ver detalles" en toasts de éxito → mitigado: sólo aparece si el caller pasa `error`/`showDetails`/`context`. Migración mecánica NO añade la acción por default.
- **Regresiones en tests** que asertan sobre `toast.success(...)` — actualizar los que rompan (esperado: pocos, están en `__tests__` que ya usan mocks de sonner).
- **Cascada de errores de query** — el `id` dedupe se mantiene, sólo cambia el helper.

## Fuera de alcance

- Rediseñar el `ErrorDetailsDialog`.
- Traducir/reescribir copy de los toasts existentes.
- Cambios en el backend o Sentry.
