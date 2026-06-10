## Causa raíz

La edge function `user-management` aún tenía hardcodeada la lista de roles legacy:

```ts
const VALID_ROLES = ["admin", "operador", "viewer"] as const;
const selectedRole = VALID_ROLES.includes(role) ? role : "viewer";
```

Cuando el modal envió `role = "contador"` (rol moderno), no estaba en la lista, así que **silenciosamente degradó a `viewer`** y guardó:

- `auth.users` → creado ✅
- `user_roles.role = viewer`
- `organization_members.role = viewer`

Por eso la pantalla de Usuarios muestra "Viewer" y en la app no tiene permisos de Contador.

## Plan

### 1. Reparar el usuario existente (Isela)

Actualizar sus dos registros a `contador` (con `insert` tool, son UPDATEs sobre datos):

- `public.user_roles` → `role = 'contador'` para `user_id = 922e1e94-bd18-43b3-9dfb-3e06738976ac`
- `public.organization_members` → mismo cambio

### 2. Sincronizar `VALID_ROLES` con el catálogo moderno

En `supabase/functions/user-management/handlers.ts`:

- Reemplazar `VALID_ROLES` por la lista completa: `admin_org, gerente_operaciones, gerente_visor, coordinador_logistico, ejecutivo_pricing, contador, tesorero, vendedor, customer_service` + legacy (`admin, operador, viewer`) para retro-compatibilidad.
- Si el `role` recibido **no está** en la lista → devolver **400 con mensaje claro** ("Rol no soportado: X"), en vez de degradar silenciosamente a viewer. Así nunca volverá a pasar este bug.

### 3. Asegurar persistencia del rol moderno

El bloque actual sólo actualiza `user_roles` cuando `selectedRole !== "viewer"`. Con la nueva lista no hay drama, pero lo dejo más explícito: siempre persistir el rol seleccionado tanto en `user_roles` como en `organization_members`.

### 4. Versionado y changelog

- `APP_VERSION` → **`12.76.10`**
- Entrada en `CHANGELOG.md` documentando el fix y la reparación del usuario.

## Archivos a tocar

- `supabase/functions/user-management/handlers.ts` — expandir `VALID_ROLES` + validación estricta.
- `src/constants/appVersion.ts` + `CHANGELOG.md` — bump.
- Una operación de datos (no migración) sobre `user_roles` y `organization_members` para reparar a Isela.

## Lo que NO toco

- Esquema de BD, enum `app_role`, función `has_role`, RLS — todo eso ya está correcto desde la versión `12.76.7`.
- Componente del modal (ya manda el rol correcto).
- `checkAdminAccess` — fix anterior (`12.76.9`) ya funciona.
