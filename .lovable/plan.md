## Objetivo

Cerrar los 2 hallazgos abiertos del escáner de seguridad sin tocar UI ni lógica de negocio.

## Hallazgo 1 — `client-error-log` (log spoofing + flooding)

Archivo: `supabase/functions/client-error-log/index.ts`

Cambios:
- **Eliminar `tryExtractUserId`** (decodifica JWT sin verificar firma). Reemplazar por verificación real:
  - Si viene `Authorization: Bearer ...`, crear `anonClient` con ese header y llamar `anonClient.auth.getClaims(token)`. Si valida, usar `claims.sub` como `user_id`. Si falla, `user_id = null` (no propagar error — el endpoint sigue siendo público).
- **Rate limit básico en memoria por IP** (sin infra nueva):
  - Mapa `Map<ip, { count, windowStart }>` a nivel módulo.
  - Ventana de 60s, máximo 20 requests/IP. Si excede → `429` con `Retry-After`.
  - IP = primer valor de `x-forwarded-for` o `cf-connecting-ip`; fallback `"unknown"`.
  - Limpieza perezosa: al insertar, purgar entradas con `windowStart` > 5 min de antigüedad.
  - Nota: es best-effort (per-instance), suficiente para frenar abuso casual; documentar en comentario que para protección dura se requiere Upstash/Redis.
- **No cambiar el contrato de respuesta** (frontend `logClientError` sigue funcionando).

Tests (`validate_test.ts` nuevo o extender existente):
- `tryExtractUserId` ya no existe → eliminar su test.
- Test: payload sin auth header → 200, `user_id` null.
- Test: 21 requests desde misma IP en <60s → la 21ª devuelve 429.

## Hallazgo 2 — `parse-csf` (cuota Gemini abusable por cliente/viewer)

Archivo: `supabase/functions/parse-csf/index.ts`

Cambios:
- Tras `authenticate(req)`, llamar `checkAdminAccess(auth.adminClient, auth.userId)`.
- Si `!isGlobalAdmin && !orgId` → `errorResponse('Solo administradores y operadores pueden usar este servicio', 403, cors)`.
- Refactor mínimo: `authenticate` actualmente se llama dentro de `processCsf` sin capturar el retorno. Cambiar a `const auth = await authenticate(req)` y pasar `auth` al check.

Tests (`validate_test.ts`):
- Añadir test que mockee `checkAdminAccess` retornando `{ isGlobalAdmin: false, orgId: null }` y verifique 403.

## Memoria de seguridad

Actualizar `security--update_memory` añadiendo:
- "client-error-log es público por diseño (errores pre-auth) pero valida JWT cuando se envía y aplica rate limit in-memory de 20 req/min/IP."
- "Edge functions con cuota externa (Gemini, JSONCargo) requieren `checkAdminAccess` después de `authenticate` — patrón aplicado en `parse-csf` y `jsoncargo-track`."

Marcar ambos findings como `mark_as_fixed` con explicación.

## Versión y changelog

- `APP_VERSION` → `12.23.1` (patch — sólo backend security).
- `CHANGELOG.md`:
  ```
  ## [12.23.1] - 2026-05-30
  - Seguridad: client-error-log ahora valida firma JWT y aplica rate limit por IP (20/min).
  - Seguridad: parse-csf restringido a admin/operadores para evitar drenaje de cuota Gemini.
  ```

## Fuera de alcance

- Migración a Upstash/Redis para rate limit distribuido.
- HMAC token de la app (mencionado en el finding pero requiere cambio en frontend bundle).
- Revisar otras edge functions públicas (sólo se atienden las 2 reportadas).

## Verificación

- `supabase--test_edge_functions` para `client-error-log` y `parse-csf`.
- `supabase--curl_edge_functions` smoke test:
  - POST a `/client-error-log` sin auth → 200.
  - POST 21 veces seguidas → última 429.
  - POST a `/parse-csf` con sesión del usuario actual (admin) → no debe regresar 403.
