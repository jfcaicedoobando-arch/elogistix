## Problema

En `/usuarios` → pestaña **Portal Agente**, el agente "Chino" aparece pero su email se muestra como vacío / `UNRESOLVED_EMAIL`.

**Causa raíz:** `fetchEmailMap()` en `portales.ts` llama a la edge `user-management` action `"list"`, que solamente devuelve usuarios de `organization_members` (los logs lo confirman: `count: 1, scope: org`). Los agentes del portal NO están en `organization_members` — viven en `agente_users` + `auth.users`, así que el `emailMap` no contiene su `user_id` y caemos al placeholder.

**Analogía:** estábamos pidiendo el directorio telefónico de empleados internos para buscar el teléfono de un visitante. El visitante no está ahí, por eso no encontramos su número.

## Solución

Nueva acción en la edge `user-management`: **`list-portal-emails`**.

- **Input:** `{ action: "list-portal-emails", user_ids: string[] }`.
- **Lógica:**
  1. Valida que el caller sea admin de organización.
  2. Filtra los `user_ids` recibidos a sólo los que estén vinculados a `client_users` o `agente_users` de la misma `organization_id` del caller (evita fuga de emails cross-org).
  3. Por cada `user_id` autorizado, lee `auth.users.email` con `adminClient.auth.admin.getUserById`.
  4. Devuelve `[{ id, email }]`.

En el frontend (`portales.ts`):

- Reemplazar `fetchEmailMap()` por `fetchPortalEmailMap(userIds: string[])` que invoque la nueva acción.
- `fetchUsuariosPortalCliente` y `fetchUsuariosPortalAgente` recolectan los `user_id` después del SELECT y luego piden el mapa con esa acción.

## Archivos

- `supabase/functions/user-management/index.ts` — registrar `"list-portal-emails"` en `ACTIONS` y el `switch`.
- `supabase/functions/user-management/agenteHandlers.ts` (o nuevo `portalEmailsHandler.ts`) — exportar `handleListPortalEmails`.
- `src/features/admin/services/usuario/portales.ts` — usar la nueva acción.
- `src/constants/appVersion.ts` → `13.135.24`.
- `CHANGELOG.md` — entrada `## [13.135.24] - 2026-06-24` describiendo el fix.

Sin cambios de UI ni de schema.
