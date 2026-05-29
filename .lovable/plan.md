## Mi Perfil — Portal del Cliente

Hoy el ítem "Mi perfil" en `PortalUserMenu` está `disabled` y no existe ninguna página ni ruta para él. Lo voy a construir.

### Alcance

Una página `/portal/perfil` con 3 secciones (solo lectura + 2 acciones):

1. **Datos personales** (solo lectura)
   - Email del usuario autenticado
   - Nombre del cliente vinculado (vía `client_users` → `clientes.nombre`)
   - Rol: Cliente

2. **Datos fiscales del cliente** (solo lectura)
   - RFC, dirección, ciudad, estado, CP, teléfono, email del cliente
   - Tomados de la tabla `clientes` (ya accesible por la policy `Cliente read own clientes`)

3. **Editar contacto** (acción)
   - Nombre del contacto, teléfono
   - Actualiza `clientes.contacto` y `clientes.telefono` del cliente vinculado

4. **Cambiar contraseña** (acción)
   - Form con contraseña actual + nueva + confirmación
   - Usa `supabase.auth.updateUser({ password })`
   - Validación: mínimo 8 caracteres, confirma coincidencia

### Cambios técnicos

**Backend / RLS**
- No requiere migración. Las policies existentes ya cubren:
  - `clientes`: `Cliente read own clientes` (SELECT) — OK
  - Para que el cliente pueda **editar su propio** `contacto`/`telefono`, agregar una policy UPDATE en `clientes` restringida a `has_role('cliente')` + `id IN current_user_client_ids()` y limitada a esos campos vía trigger o simplemente policy de UPDATE (los demás campos no se exponen en el form).
  - Alternativa más segura: una RPC `portal_update_contacto(nombre text, telefono text)` `SECURITY DEFINER` que actualice solo esos 2 campos del cliente vinculado al `auth.uid()`. **Esta es la opción recomendada** siguiendo el patrón ya usado en el portal (mem://technical/security-patterns).

**Frontend**
- `src/pages/portal/PortalPerfil.tsx` — página nueva (componente ≤200 líneas, dividida en subcomponentes si crece)
- `src/components/portal/perfil/PerfilDatosCard.tsx` — datos personales + fiscales (read-only)
- `src/components/portal/perfil/EditarContactoDialog.tsx` — form de contacto
- `src/components/portal/perfil/CambiarPasswordDialog.tsx` — form de contraseña
- `src/hooks/portal/usePortalPerfil.ts` — query del cliente vinculado + mutaciones
- `src/lib/query/keys/portal.ts` — agregar `perfil` key
- `src/routes/portalRoutes.tsx` — agregar ruta `/portal/perfil`
- `src/components/portal/layout/PortalUserMenu.tsx` — quitar `disabled` y convertir en `<Link to="/portal/perfil">`
- `src/components/portal/layout/PortalMobileNav.tsx` — si tiene el mismo item, igual

**Versionado**
- `APP_VERSION` → 12.17.2 (patch, feature pequeña)
- `CHANGELOG.md` → entrada nueva

### Diseño

Layout estándar del portal: card con header "Mi Perfil" y secciones apiladas, usando tokens semánticos (`bg-card`, `text-muted-foreground`, `accent`). Sin colores hardcoded.

### Fuera de alcance

- Editar RFC / dirección fiscal (eso lo gestiona el forwarder, no el cliente)
- Avatar / foto
- Preferencias de notificaciones (se puede agregar después)
