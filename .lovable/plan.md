

## Plan: Quitar validaciones obligatorias temporalmente — v3.12.5

### Cambios en `src/pages/NuevoEmbarque.tsx`

1. **`isStep1Valid()`** (línea 127-131): Cambiar para que siempre retorne `true`
2. **`isStep2Valid()`** (línea 133-138): Cambiar para que siempre retorne `true`
3. **Botón "Siguiente"** (línea 305): Quitar la condición `disabled` que depende de las validaciones

### Cambios en `src/pages/Changelog.tsx`
- Agregar entrada v3.12.5: "Validaciones obligatorias deshabilitadas temporalmente para pruebas"

### Archivos modificados
- `src/pages/NuevoEmbarque.tsx`
- `src/pages/Changelog.tsx`

