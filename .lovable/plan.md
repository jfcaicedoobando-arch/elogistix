## Crear usuario de prueba para el Portal del Agente

**Analogía:** es como hacer una llave de prueba para entrar al portal — la creamos manualmente esta vez para no esperar el correo de invitación.

### Lo que voy a hacer

1. **Crear el usuario en la base** con email y contraseña fijos (ya confirmado, sin necesidad de correo de activación).
2. **Asignarle el rol `agente_carga`** en `user_roles`.
3. **Vincularlo a un agente existente** en `agente_users` para que la RLS lo deje ver sus datos. Sugiero usar **LONGSAIL** (el primero activo) — si prefieres otro, dímelo.
4. **Verificar** que al iniciar sesión aterriza en `/agente`.

### Credenciales propuestas

- **Email:** `agente.demo@librecarga.com`
- **Contraseña:** `AgenteDemo2026!`
- **Agente vinculado:** LONGSAIL (organización dueña de ese agente)

### Detalles técnicos

- Una sola migración SQL que:
  - Inserta en `auth.users` vía `extensions` con `email_confirmed_at = now()` y password hasheado (`crypt`).
  - Inserta en `public.user_roles (user_id, role='agente_carga')`.
  - Inserta en `public.agente_users (user_id, agente_id, organization_id)` apuntando a LONGSAIL.
- No toca código frontend ni edge functions — el portal `/agente` ya existe (v13.128.0).
- Bumpeo `APP_VERSION` a `13.128.1` y agrego entrada al `CHANGELOG.md`.

### Cómo probarlo después

1. Cerrar sesión actual.
2. Ir al login y entrar con las credenciales de arriba.
3. Debería redirigir automáticamente a `/agente` (Inicio del portal).
4. En **Embarques** verás sólo los embarques cuyo campo `agente` sea "LONGSAIL"; en **Tarifas** sólo las suyas.

### Confirma antes de implementar

- ¿Email/contraseña sugeridos están bien o quieres otros?
- ¿Vinculo a **LONGSAIL** o prefieres otro agente (SHENZHEN GOLDEN o CTL LOGISTICS MEXICO)?
