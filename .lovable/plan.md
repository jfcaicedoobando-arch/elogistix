# Wrapper único para Browser Storage

## Inventario actual (6 consumidores)

| # | Archivo | API | Claves |
|---|---------|-----|--------|
| 1 | `src/contexts/ThemeContext.tsx` | localStorage get/set | `librecarga-theme` |
| 2 | `src/contexts/OrganizationContext.tsx` | localStorage get/set | `sa_active_org` |
| 3 | `src/lib/queryClient.ts` | localStorage (ref para persister) | `lc-query-cache-v1` (managed por TanStack) |
| 4 | `src/contexts/auth/useLoginAudit.ts` | sessionStorage get/set/remove | `lc:login-logged:{userId}` |
| 5 | `src/main.tsx` | sessionStorage get/set/remove | `chunk-error-auto-reload` |
| 6 | `src/components/shared/ErrorBoundary.tsx` | sessionStorage get/set | `chunk-error-auto-reload` (mismo que main.tsx) |

Excluido: `src/integrations/supabase/client.ts` (auto-generado, no se edita).

## Diseño del wrapper

Crear `src/lib/browserStorage/index.ts` con:

- **`safeLocalStorage`** y **`safeSessionStorage`**: objetos con `getItem / setItem / removeItem` que:
  - Devuelven `null` / hacen no-op si `typeof window === "undefined"` (SSR-safe).
  - Envuelven cada operación en `try/catch` (cuota llena, modo privado Safari, storage deshabilitado) y reportan vía `console.warn` sin propagar.
  - Aceptan tipos estrictos (`string` en/out, sin `any`).
- **`getStorageRef(kind: "local" | "session")`**: devuelve la referencia cruda `Storage | undefined` para librerías que requieren el objeto nativo (TanStack persister).
- **`STORAGE_KEYS`** const con las 4 claves del proyecto, tipado como literal union para evitar typos:
  ```ts
  export const STORAGE_KEYS = {
    theme: "librecarga-theme",
    superAdminActiveOrg: "sa_active_org",
    chunkErrorReload: "chunk-error-auto-reload",
    queryCache: "lc-query-cache-v1",
    loginLoggedPrefix: "lc:login-logged:",
  } as const;
  ```
  El prefix `lc:login-logged:` expone un helper `loginLoggedKey(userId)`.

## Migraciones

1. **ThemeContext.tsx** → `safeLocalStorage.getItem(STORAGE_KEYS.theme)` / `setItem`. Eliminar try/catch local.
2. **OrganizationContext.tsx** → `safeLocalStorage.getItem(STORAGE_KEYS.superAdminActiveOrg)` / `setItem`.
3. **queryClient.ts** → `storage: getStorageRef("local")`. La constante `lc-query-cache-v1` queda referenciada como `STORAGE_KEYS.queryCache`.
4. **useLoginAudit.ts** → `safeSessionStorage.getItem(loginLoggedKey(user.id))` / `setItem` / `removeItem`. Eliminar los 3 try/catch + guards `typeof sessionStorage`.
5. **main.tsx** → helpers `markChunkReloadAttempted() / hasChunkReloadBeenAttempted() / clearChunkReloadFlag()` exportados desde el wrapper para no duplicar lógica con ErrorBoundary.
6. **ErrorBoundary.tsx** → consume los mismos 3 helpers de paso 5.

## Tests

- Nuevo `src/lib/browserStorage/__tests__/browserStorage.test.ts`:
  - Mock `window.localStorage` con un `Map` para verificar get/set/remove.
  - Caso "storage lanza QuotaExceededError" → `setItem` no propaga; `console.warn` es llamado una vez.
  - Caso SSR (`window === undefined`) → `getItem` devuelve `null`, `setItem` no-op.
  - Caso `chunkErrorReload` helpers → flujo set→has→clear.

## Verificación

- `bunx tsc --noEmit` limpio.
- `bunx eslint src --max-warnings=0` sin nuevos warnings.
- `bunx vitest run` con los nuevos tests pasa (target ~630).
- `rg "(localStorage|sessionStorage)\." src` devuelve sólo los archivos del wrapper + `integrations/supabase/client.ts`.
- Smoke manual: tema persiste entre refresh; super-admin recuerda org activa; reload tras chunk error sólo ocurre una vez.

## Memoria + changelog

- Nueva entrada `mem://technical/browser-storage` apuntando al wrapper como única vía.
- Changelog `11.29.0` en `chunks/0.ts` + `recentChangelog` (manteniendo top 10).
- Bump `APP_VERSION` a `11.29.0`.
