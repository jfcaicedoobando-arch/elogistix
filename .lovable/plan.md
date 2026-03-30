

# Plan: Corregir visibilidad de la Bitácora de Actividad

## Problema identificado

Las políticas de seguridad (RLS) de la tabla `bitacora_actividad` tienen dos errores que bloquean la lectura:

1. **Super Admin no puede ver nada**: La política "Tenant admin bitacora" requiere `has_role('admin')` al final, pero el super_admin tiene rol `super_admin`, no `admin`. Esto significa que el AND final siempre falla para super_admin.

2. **Admins de organización con rol global `viewer` no ven nada**: La política usa `has_role()` que consulta la tabla `user_roles` (rol global), no el rol dentro de `organization_members`. Usuarios como hector@lopezbenavides.com que son admin a nivel org pero viewer a nivel global, quedan bloqueados.

3. **Super Admin sin membresía de org**: `current_user_org_id()` retorna NULL para super_admin porque no es miembro de ninguna organización, así que la política de "own bitacora" también falla.

## Solución

Actualizar las políticas RLS de `bitacora_actividad` para:

### Política 1 — Admin de organización puede leer
Permitir lectura si el usuario es admin **a nivel organización** (usando `is_org_admin`) o tiene rol global `admin`:
```sql
DROP POLICY "Tenant admin bitacora" ON bitacora_actividad;
CREATE POLICY "Tenant admin bitacora" ON bitacora_actividad
  FOR SELECT TO authenticated
  USING (
    (organization_id = current_user_org_id() AND is_org_admin(auth.uid(), organization_id))
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'super_admin')
  );
```

### Política 2 — Usuarios ven su propia actividad (sin cambios estructurales, solo quitar restricción de org para super_admin)
La política existente "Tenant user own bitacora" se mantiene porque funciona correctamente para usuarios normales.

### Resultado esperado
- Super admins ven toda la bitácora de cualquier organización
- Admins de organización ven toda la bitácora de su organización
- Usuarios normales siguen viendo solo su propia actividad

## Archivos a modificar
- **Migración SQL**: Reemplazar la política "Tenant admin bitacora"
- **`src/pages/Changelog.tsx`**: Agregar entrada v7.4.1

