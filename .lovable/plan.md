## Objetivo
El modal de **Nuevo Proveedor** no debe pre-cargar ningún valor en el primer dropdown (**Categoría**). El usuario debe seleccionarlo explícitamente.

## Cambios

### 1. Controller: `src/hooks/proveedor/useNuevoProveedorController.ts`
- Cambiar el default de `categoria` en `EMPTY_PROVEEDOR_FORM` de `"Logistico"` a `""`.
- Agregar validación en `isStep1Valid` para exigir que `form.categoria` no esté vacío.

### 2. UI: `src/components/proveedor/NuevoProveedorDialog.tsx`
- Agregar `placeholder="Selecciona categoría"` al `<SelectValue />` del campo **Categoría**.

### 3. Test: `src/hooks/proveedor/__tests__/useNuevoProveedorController.test.tsx`
- Actualizar el test para que asigne `categoria` antes de validar `isStep1Valid`.

## Notas técnicas
- El resto de la lógica condicional (`isLogistico`, `isGasto`, etc.) ya funciona con categoria vacía (ambas son `false`), por lo que los campos dependientes simplemente no se mostrarán hasta que el usuario elija una categoría.
- No se requiere crear un `<SelectItem value="">`; el placeholder de Radix se muestra cuando el `value` del `<Select>` es `""` y no hay un item con ese value.