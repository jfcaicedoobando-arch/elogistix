

## Plan: Panel Exclusivo para Super Admin (sin membresía a organizaciones)

### Concepto

El Super Admin es el administrador global de la plataforma. No pertenece a ninguna organización — administra todas. Al iniciar sesión, se le redirige directamente a `/admin` en lugar de `/` (dashboard de org). El enlace "Ir a la app" se elimina ya que no tiene contexto de organización.

---

### Cambios

#### 1. Redirección post-login según rol

**Login.tsx**: Después de un login exitoso, verificar si el usuario es `super_admin`. Si lo es, redirigir a `/admin` en vez de `/`.

**ProtectedRoute.tsx**: En las rutas regulares (Layout), si el usuario es `super_admin` y no tiene membresía a ninguna org, redirigir a `/admin`.

#### 2. OrganizationContext — Super Admin sin org propia

Actualmente el super_admin carga todas las orgs y selecciona una. Mantener este comportamiento para "impersonar" orgs cuando navega dentro del panel admin (ver datos de una org específica), pero **no forzar** que tenga membresía.

Ajustar `current_user_org_id()` o las queries del panel admin para que funcionen sin membresía.

#### 3. Panel Admin mejorado

**AdminSidebar.tsx**:
- Eliminar "Ir a la app" (el super_admin vive en `/admin`)
- Agregar sección "Configuración Global" con opciones como: Configuración de la plataforma, Planes/Billing (placeholder)

**AdminLayout.tsx**:
- Mantener el selector de organización en el header para "impersonar" y ver datos de orgs específicas
- Agregar indicador visual de qué org se está viendo

**Nuevas páginas admin**:
- `/admin/configuracion` — Configuración global de la plataforma (parámetros que aplican a todas las orgs)

#### 4. Eliminar membresía del super_admin

**Migración SQL**: Eliminar al usuario super_admin de `organization_members` para que no pertenezca a ninguna org.

Ajustar `current_user_org_id()` para que no falle si el super_admin no tiene membresía — ya los RLS policies tienen `OR has_role(auth.uid(), 'super_admin')`.

#### 5. Auth y routing

- Login: detectar rol post-login y redirigir apropiadamente
- Si un super_admin intenta acceder a `/`, redirigir a `/admin`
- Las rutas `/admin/*` solo accesibles para `super_admin`

---

### Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| `src/pages/Login.tsx` | Redirigir a `/admin` si es super_admin |
| `src/components/ProtectedRoute.tsx` | Redirigir super_admin sin org a `/admin` |
| `src/contexts/OrganizationContext.tsx` | Manejar super_admin sin membresía |
| `src/components/admin/AdminSidebar.tsx` | Quitar "Ir a la app", agregar config global |
| `src/pages/admin/AdminConfiguracion.tsx` | **Nuevo** — Config global de plataforma |
| `src/App.tsx` | Agregar ruta `/admin/configuracion` |
| `src/pages/Changelog.tsx` | Entrada v6.2.0 |
| **Migración SQL** | Eliminar super_admin de `organization_members` |

---

### Detalles técnicos

- El super_admin ya tiene acceso a todos los datos via RLS (`has_role(auth.uid(), 'super_admin')`), por lo que eliminar su membresía no rompe el acceso a datos.
- La función `current_user_org_id()` retornará NULL para el super_admin, pero eso está cubierto por la cláusula OR en las políticas RLS.
- Para el panel admin, el selector de org en el header permite al super_admin "impersonar" una org para ver sus datos (funcionalidad existente).

