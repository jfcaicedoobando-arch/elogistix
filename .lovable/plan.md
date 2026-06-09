# Fix: `/usuarios` muestra UUIDs en `librecarga.com`

## Causa raíz
El dominio custom de producción es **`https://librecarga.com`** y **`https://www.librecarga.com`**, pero el whitelist de CORS en `supabase/functions/_shared/cors.ts` sólo acepta:
- sufijos `.lovable.app` y `.lovableproject.com`
- `http://localhost:8080|5173|3000`

Resultado en producción:
1. `fetchUsuariosOrganizacion` invoca `user-management` con `action: "list"`.
2. La función responde **200** con los usuarios (verificado en `function_edge_logs`).
3. La respuesta lleva `Access-Control-Allow-Origin: "null"` porque el origen `librecarga.com` no pasa `isAllowedOrigin`.
4. El navegador bloquea la respuesta; `supabase.functions.invoke` retorna error.
5. El `catch` en `src/services/usuario/index.ts:47` deja `emailMap` vacío y la línea 53 cae al fallback `m.user_id` → la tabla pinta UUIDs.

El mismo bug afecta a **toda** edge function autenticada que use `buildCors` cuando se llama desde el custom domain (parse-csf, auditoria-*, invitaciones de cliente, etc.). Solo se ha notado en `/usuarios` porque ahí el degradado es visible en pantalla.

## Fix

### 1. Whitelist explícita del dominio custom
Editar `supabase/functions/_shared/cors.ts`:

- Agregar a `ALLOWED_EXACT` (o equivalente):
  - `https://librecarga.com`
  - `https://www.librecarga.com`

Mantener la lista por sufijos para `*.lovable.app` y `*.lovableproject.com`. Sigue siendo whitelist estricto, no se relaja la seguridad — sólo se incorporan los dos hosts reales del producto.

### 2. Sin cambios de código en cliente
`fetchUsuariosOrganizacion` ya está correcto. El fallback a UUID se queda como red de seguridad, pero ya no se disparará en flujo normal.

### 3. Versión + changelog
- `APP_VERSION` → `12.64.5`.
- Entrada en `CHANGELOG.md` describiendo el fix de CORS y enumerando que arregla `/usuarios`, parse-csf, auditoría, invitaciones de cliente, etc.

### 4. Validación post-deploy
- El smoke test creado en 12.64.3 (`supabase/functions/user-management/smoke_test.ts`) ya valida el contrato JSON. No requiere cambios.
- Manual: refrescar `https://librecarga.com/usuarios` y verificar que las filas muestren emails reales.
- Opcional: agregar un test unitario en `supabase/functions/_shared/cors_test.ts` que valide `isAllowedOrigin("https://librecarga.com") === true` para prevenir regresión si alguien refactoriza el whitelist.

## Notas
- Es un cambio sólo de edge function — se despliega automáticamente al confirmar; no requiere republish del frontend.
- No toca RLS, ni base de datos, ni roles.
- Si en el futuro se agregan más dominios custom (`forwarderx.com`, etc.), se agregan en el mismo set.
