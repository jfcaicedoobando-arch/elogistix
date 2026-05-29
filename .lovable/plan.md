# Plan: 4 mejoras a Acceso al Portal de Cliente

Versión objetivo: **APP_VERSION → 12.18.0** (feature, no patch).

## Alcance

En `TabPortalCliente` (tab "Portal" del detalle de cliente), enriquecer la tabla de usuarios con acceso al portal y agregar acciones.

### 1. Mostrar email
- Hoy la tabla muestra solo `user_id` truncado. Mostrar el **email real** del usuario.
- Backend: nueva edge function `list-client-users` (service role) que recibe `cliente_id`, valida que el caller sea staff de la organización dueña del cliente (admin/operador/super_admin), lee `client_users` por `cliente_id` y enriquece con `auth.admin.getUserById()` para devolver `{ id, user_id, email, created_at, last_sign_in_at, email_confirmed_at }`.
- Reemplaza el `useClientUsers` actual (que hace `select * from client_users`) para que llame la edge function vía un nuevo service `fetchClientUsersEnriched`.

### 2. Último login
- Mostrar columna **"Último acceso"** con `last_sign_in_at` formateado (`dd MMM yyyy HH:mm`) o "Nunca".
- Resaltar en `text-muted-foreground` si >30 días o "Nunca" → ayuda a detectar usuarios inactivos.

### 3. Reenviar invitación
- Botón **"Reenviar invitación"** (icono `Mail`) visible solo cuando `email_confirmed_at IS NULL` **o** `last_sign_in_at IS NULL` (usuario nunca estableció contraseña / nunca entró).
- Reutiliza la edge function existente `invite-client-user` pasando el mismo email + `cliente_id` + `organization_id`. La función ya maneja "usuario existente" y reenvía link de recovery (ajuste menor: forzar generación de link `recovery` si el usuario ya existe pero no ha confirmado).

### 4. Indicador visual "N usuarios con acceso"
- En el header del Card (`CardTitle`), badge al lado del título: `<Badge variant="secondary">{count} usuario{s} con acceso</Badge>`.
- Si `count === 0`, badge `outline` con texto "Sin acceso".

## Cambios técnicos

### Backend
- **Nueva edge function**: `supabase/functions/list-client-users/index.ts`
  - Body: `{ cliente_id: string }`
  - Valida JWT, valida que el caller pertenezca a la org dueña del `cliente_id` con rol admin/operador/super_admin.
  - Devuelve array enriquecido.
  - CORS estándar, validación con zod.
- **Edge function existente** `invite-client-user`: pequeño ajuste — si el usuario ya existe pero `email_confirmed_at IS NULL`, generar un `recovery` link y enviarlo (idempotente para "reenviar"). Si ya está confirmado, devolver mensaje claro "Usuario ya activo" sin reenviar.

### Frontend
- `src/services/cliente-usuarios/index.ts`: agregar `fetchClientUsersEnriched(clienteId)` que invoca `list-client-users`, y `resendClientUserInvite(params)` que reusa `inviteClientUser`.
- `src/hooks/cliente/useClientUsersMutations.ts`: 
  - Cambiar `useClientUsers` para usar el nuevo fetcher enriquecido.
  - Agregar `useResendClientUserInvite(clienteId)`.
  - Exportar tipo `ClientUserEnriched`.
- `src/components/cliente/TabPortalCliente.tsx`:
  - Nuevas columnas: Email, Último acceso, Estado (badge "Activo"/"Pendiente"/"Inactivo").
  - Reemplazar columna `Usuario ID` por `Email`.
  - Botón "Reenviar invitación" condicional en columna de acciones.
  - Badge de conteo en el header.
- Sin cambios en RLS ni migraciones (la edge function usa service role).

### Versionado
- `APP_VERSION` → `12.18.0`
- Entrada en `CHANGELOG.md` describiendo las 4 mejoras.

## Fuera de alcance
- Revocar/reasignar usuarios entre clientes.
- Auditoría de logins (ya cubierta por `bitacora_actividad`).
- Notificaciones por email cuando un usuario del portal entra.

¿Procedo?