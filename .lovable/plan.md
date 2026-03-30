

# Plan: Mostrar el rol organizacional en lugar del rol global en el sidebar

## Problema
El sidebar muestra el rol de la tabla `user_roles` (rol global de plataforma), pero para usuarios regulares el rol relevante es el de `organization_members` (rol dentro de su organización). Por eso `hector@lopezbenavides.com` aparece como "viewer" aunque es admin de Elogistix.

## Impacto actual
- El badge del sidebar muestra un rol incorrecto para usuarios cuyo rol global difiere del organizacional
- La lógica de permisos (`usePermissions`) también usa el rol global, lo que podría estar bloqueando funcionalidades que el usuario debería tener como admin de organización

## Solución

### 1. Modificar `AuthContext.tsx` para obtener también el rol organizacional
Agregar una consulta a `organization_members` para obtener el rol del usuario dentro de su organización. Exponer un campo `orgRole` en el contexto.

### 2. Modificar `AppSidebar.tsx`
Mostrar el `orgRole` (rol organizacional) cuando esté disponible, cayendo al rol global como fallback. Para super_admin, seguir mostrando "Super Admin".

### 3. Modificar `usePermissions.ts`
Usar el rol organizacional como fuente primaria de permisos para usuarios regulares, manteniendo el rol global solo para super_admin.

### 4. Actualizar `Changelog.tsx`
Agregar entrada v7.4.5.

## Detalle técnico
```text
Flujo actual:
  AuthContext → user_roles.role → "viewer" → sidebar badge

Flujo corregido:
  AuthContext → organization_members.role → "admin" (para usuarios con membresía)
             → user_roles.role (fallback para super_admin sin membresía)
```

## Archivos a modificar
- `src/contexts/AuthContext.tsx` — agregar fetch de `organization_members.role`
- `src/components/AppSidebar.tsx` — usar rol organizacional
- `src/hooks/usePermissions.ts` — usar rol organizacional como fuente primaria
- `src/pages/Changelog.tsx` — entrada v7.4.5

