

# Login Unificado

## Resumen
Eliminar `/portal/login` y usar únicamente `/login`. Después de autenticar, el sistema detecta el rol y redirige automáticamente.

## Cambios

### 1. Actualizar `/login` (Login.tsx)
- Eliminar la opción de registro (signup) — los clientes se invitan, no se registran solos.
- Después de `signInWithPassword`, consultar `user_roles` y redirigir:
  - `super_admin` → `/admin`
  - `cliente` → `/portal`
  - Cualquier otro → `/`
- **Ya hace esto parcialmente**, solo falta quitar el toggle de registro.

### 2. Redirigir `/portal/login` → `/login`
- En `App.tsx`, reemplazar la ruta `/portal/login` con un `<Navigate to="/login" replace />`.
- Eliminar el archivo `src/pages/portal/PortalLogin.tsx`.

### 3. Actualizar `PortalProtectedRoute`
- Cambiar la redirección de usuarios no autenticados de `/portal/login` a `/login`.

### 4. Actualizar `ProtectedRoute`
- Verificar que redirige a `/login` (ya debería hacerlo).

### 5. Changelog
- Nueva entrada v7.10.0: "Login unificado".

## Archivos
| Archivo | Cambio |
|---|---|
| `src/pages/Login.tsx` | Quitar toggle de registro |
| `src/App.tsx` | Redirigir `/portal/login` → `/login` |
| `src/pages/portal/PortalLogin.tsx` | **Eliminar** |
| `src/components/PortalProtectedRoute.tsx` | Redirigir a `/login` |
| `src/pages/Changelog.tsx` | Nueva entrada |

