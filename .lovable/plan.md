

# Fix: Sidebar "Usuarios" y "Configuración" no funcionan para admin de organización

## Problema identificado

El usuario `hector@lopezbenavides.com` tiene:
- Rol global: **viewer**
- Rol organizacional: **admin** (en Elogistix)

El `effectiveRole` se calcula correctamente como `admin`, por lo que el sidebar muestra los enlaces de "Usuarios" y "Configuración". Sin embargo, al hacer clic, `ProtectedRoute` en línea 38 valida contra el **rol global** (`role` = `viewer`), no contra `effectiveRole`. Como `viewer` no está en `["admin"]`, redirige a `/`.

## Solución

### 1. `src/components/ProtectedRoute.tsx`
- Usar `effectiveRole` en lugar de `role` para la validación de `allowedRoles` (línea 38).
- Cambiar `const { user, role, loading } = useAuth()` → `const { user, role, effectiveRole, loading } = useAuth()`.
- Línea 38: `!allowedRoles.includes(role as AppRole)` → `!allowedRoles.includes(effectiveRole as AppRole)`.

### 2. `src/pages/Changelog.tsx`
- Nueva entrada v7.10.1: "Fix: permisos de rutas usan rol efectivo de organización".

