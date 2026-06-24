## Problema

A los agentes de carga en China muchas veces no les llega el email de invitación (firewalls, filtros, dominios bloqueados). Hoy el modal solo pide email y dispara un correo de Supabase — si nunca llega, el agente no entra. El admin de operaciones no tiene forma de saltarse el correo y darle credenciales directas (por ej. por WeChat/WhatsApp).

## Solución

Hacer que el modal "Invitar agente al Portal" permita **dos modos**:

1. **Por email** (actual): solo email → llega correo con magic link / reset password.
2. **Manual con contraseña**: email + contraseña → el sistema crea la cuenta ya confirmada y lista para usar. El admin copia las credenciales y se las pasa al agente por el canal que sea.

Toggle / tab dentro del mismo `FormDialogShell` (sin nuevo modal). En modo manual se muestran las credenciales en pantalla tras crear con un botón "Copiar".

## Cambios

### Frontend (`InvitarAgentePortalDialog.tsx`)
- Agregar `Tabs` (o `RadioGroup`) con 2 opciones: **Enviar por email** | **Asignar contraseña**.
- En modo manual: input de contraseña (mínimo 8 caracteres) + checkbox "Mostrar contraseña" + botón "Generar segura" que llena un random de 12 chars.
- Validar contraseña antes de enviar.
- Mandar `mode: "email" | "password"` y opcionalmente `password` al edge function.
- Tras éxito en modo `password`: mostrar bloque con email y contraseña + botones "Copiar email" / "Copiar contraseña" / "Copiar ambos". El modal no se cierra automáticamente; el admin lo cierra manualmente cuando ya copió.
- Toast diferente: "Cuenta creada con contraseña — copia las credenciales antes de cerrar".

### Backend (`agenteHandlers.ts` + `index.ts`)
- `validateInviteAgente` acepta opcional `mode` (default `"email"`) y `password` (requerido si `mode === "password"`, mínimo 8 chars).
- Nueva ruta `inviteOrCreateUserWithPassword`:
  - Si el usuario **no existe**: `adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: "agente_carga" } })`.
  - Si **ya existe**: `adminClient.auth.admin.updateUserById(userId, { password, email_confirm: true })` (resetea la contraseña al valor provisto). Loggear `password_reset_by_admin` en bitácora.
- En ambos casos, mismo flujo posterior: `ensureAgenteRole` + upsert en `agente_users`.
- Respuesta incluye `mode_used` y `is_new` (la contraseña NO se devuelve; el frontend ya la tiene en memoria).
- Logging: `log.finish(200, "agente_user_created_with_password", { ... })` para distinguir del flow email.

### Bitácora
- Insertar en `bitacora_actividad`: acción `Agente: cuenta creada con contraseña` (módulo `Costeo Agentes`) cuando `mode === "password"`, para auditoría (quién creó la cuenta y a qué agente).

### Versionado
- `src/constants/appVersion.ts` → `13.135.20`.
- Entrada en `CHANGELOG.md`.

### Tests (opcional, solo si existen para este flujo)
- Actualizar `supabase/functions/user-management/smoke_test.ts` y `validate_test.ts` con caso `mode=password`.

## UX (mockup texto)

```text
┌─ Invitar agente al Portal ─────────────────────┐
│ Envía una invitación a [Agente] ...            │
│                                                 │
│ Método:                                         │
│  ( ) Enviar invitación por email                │
│  (•) Asignar contraseña manualmente             │
│                                                 │
│ Email del agente:                               │
│  [contacto@agente.com           ]               │
│                                                 │
│ Contraseña:                                     │
│  [••••••••••••] [👁] [Generar segura]           │
│  Mínimo 8 caracteres.                           │
│                                                 │
│ ℹ️ Útil cuando el correo no llega (China, etc). │
│   Después comparte las credenciales por el      │
│   canal que prefieras (WeChat, WhatsApp).       │
│                                                 │
│        [ Cancelar ]  [ Crear cuenta ]           │
└─────────────────────────────────────────────────┘
```

Tras éxito en modo password:

```text
✓ Cuenta creada
Email:       contacto@agente.com    [Copiar]
Contraseña:  Hk7-mP9$Xq2L           [Copiar]
            [ Copiar ambos ]  [ Cerrar ]
```

## Riesgo

Bajo. El edge function ya tiene service-role; agregar `createUser` con `email_confirm: true` es API estándar de Supabase. La contraseña viaja por HTTPS y nunca se loggea (ni en bitácora ni en `app_logs`). Si el admin pierde la contraseña, puede reabrir el modal y "Asignar contraseña" otra vez — la reescribe.
