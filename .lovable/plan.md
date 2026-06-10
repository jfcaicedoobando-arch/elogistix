## Cambios

### 1. `src/hooks/proveedor/useNuevoProveedorController.ts`
- Eliminar del `isStep1Valid` la validación de `form.cp.trim()` para proveedores de tipo Gasto Operativo.
- Eliminar el comentario asociado sobre CFDI 4.0.
- El régimen fiscal ya fue removido de `isStep1Valid` en turno anterior.

### 2. `src/components/proveedor/NuevoProveedorDialog.tsx`
- Cambiar la etiqueta del campo CP de `Código Postal *` a `Código Postal` (quitar asterisco de obligatorio).

### 3. Tests
- Verificar que el test existente sigue pasando (no setea CP y ya pasaba antes; ahora CP es opcional, así que sigue siendo válido).

### 4. Changelog
- Bump a `12.76.19` con entrada descriptiva.