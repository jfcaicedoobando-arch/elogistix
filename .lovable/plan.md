# Estado: limpieza de warnings (parcial)

## Avance
- **39 → 6 warnings** ya eliminados en build mode.
- 4 tandas aplicadas: directivas huérfanas, fast-refresh, hook deps, complejidad ciclomática.

## Pendientes finales (necesitan build mode)
1. **`supabase/functions/user-management/handlers.ts`** (368 → ≤250 líneas)
   - Mover `handleInviteClient`, `handleListClients`, `resolveRedirectTo` (+ helpers) a un nuevo archivo `clientHandlers.ts`.
   - En `handlers.ts` dejar solo re-exports: `export { resolveRedirectTo, handleInviteClient, handleListClients } from "./clientHandlers.ts";`
   - Tipos `HandlerCtx` y `AdminAccess` se importan desde `handlers.ts` en `clientHandlers.ts`.

2. **`supabase/functions/process-email-queue/index.ts`** (5 warnings: 294 líneas, función de 230 líneas, complejidad 56, anidamiento 5×2)
   - Dividir en módulos hermanos:
     - `queueAuth.ts` — `parseJwtClaims`, `isRateLimited`, `isForbidden`, `getRetryAfterSeconds`.
     - `dlq.ts` — `moveToDlq`.
     - `messageProcessor.ts` — el bucle interno de envío por mensaje (extraído del `for` de líneas 192–356).
     - `index.ts` (orquestador ≤100 líneas) que sólo autentica, lee config, llama a `processQueue('auth_emails')` y `processQueue('transactional_emails')`.
   - Convertir los 2 bloques anidados en 5 niveles (líneas 183 y 244) a funciones helper para bajar `max-depth` a 4.

## Cierre tras los dos pasos
- `bun run lint` debe arrojar **0/0**.
- Bump `APP_VERSION` → `12.76.4`.
- Entrada `[12.76.4]` en `CHANGELOG.md`:
  - "Linter limpio (0 warnings): hooks deps estabilizados, complejidad ciclomática ≤16 en componentes/servicios/edge functions, archivos ≤250 líneas."

¿Aplico estos dos cambios finales?
