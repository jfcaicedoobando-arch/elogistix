## Problema

Hoy, en `/admin/organizaciones/:id`, el botón **"Agregar miembro"** muestra un combo con TODOS los usuarios del sistema (vía `useAvailableUsers` → edge function `user-management` action `list`). Esto contradice la regla de negocio: **un usuario pertenece a una sola organización**. Si se "agrega" a un usuario que ya es miembro de otra org, queda con membresías cruzadas y la sesión rompe el aislamiento multi-tenant.

Además, la única restricción en BD es `UNIQUE (organization_id, user_id)` — no impide que el mismo `user_id` aparezca en dos organizaciones distintas. Buena noticia: ya no hay duplicados en producción, así que podemos endurecer la restricción sin migrar datos.

**Analogía:** es como si en un edificio de oficinas el portero pudiera "mover" a un empleado de Coca-Cola a Pepsi con un clic, en lugar de obligar a Pepsi a contratar a alguien nuevo. Vamos a quitar el botón de "mover" y dejar sólo el de "contratar".

## Cambios

### 1. UI: reemplazar diálogo de agregar miembro
- Renombrar `AgregarMiembroOrgDialog` → `CrearMiembroOrgDialog`.
- Campos: **Email**, **Contraseña** (con generador), **Rol en la organización** (mismo `ASSIGNABLE_ROLES_ADMIN_ORG`).
- Quitar el `Select` de usuarios existentes y la dependencia de `useAvailableUsers` / `existingUserIds`.
- Botón del card pasa de **"Agregar miembro"** a **"Crear miembro"** (`UserPlus` + texto).
- Texto del card y placeholders ajustados al nuevo flujo.

### 2. Hook + servicio
- Nuevo `useCreateOrgMember` que invoca la edge function `user-management` con `action: "create"` y un nuevo campo `organization_id` (para que un super admin pueda crear dentro de cualquier org, no sólo la suya).
- Eliminar `useAddOrgMember` y `addOrgMember` (servicio) — ya no se usan desde la UI.
- Eliminar `useAvailableUsers` del flujo de organización (puede quedarse si otros consumidores lo usan; revisar `rg useAvailableUsers`).

### 3. Edge function `user-management` (acción `create`)
- Aceptar `organization_id` opcional en el payload.
- Si quien llama es **super_admin global** y se envía `organization_id`, insertar la membresía en esa org en vez de en `admin.orgId`.
- Si NO es super_admin global, ignorar `organization_id` y seguir usando `admin.orgId` (sin cambio).
- Validar que la org exista antes de insertar.

### 4. BD: endurecer "1 usuario = 1 org"
Migración que agrega:
```sql
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_user_id_unique UNIQUE (user_id);
```
No requiere backfill — ya verifiqué que no hay duplicados.

### 5. Limpieza
- Borrar `AgregarMiembroOrgDialog.tsx` (renombrado).
- Actualizar `OrgMembersCard` para no recibir `existingUserIds`.
- Actualizar `useAdminOrgDetalle` para no calcular `existingUserIds`.
- Actualizar tests que mencionan `useAddOrgMember` / `addOrgMember`.
- `CHANGELOG.md` + `APP_VERSION` (bump patch).

## Fuera de alcance

- Flujo de "transferir" un usuario entre organizaciones (si surge la necesidad, se diseña aparte: implica baja en la org origen + alta en la destino + invalidar sesiones).
- Cambios al módulo de Configuración o al sidebar del super admin.
