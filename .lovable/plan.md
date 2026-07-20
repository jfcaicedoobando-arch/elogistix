## Plan: Quitar flechas de inputs numéricos en edición de embarque

### Objetivo
Eliminar los botones de incremento/decremento (spinners) que aparecen por defecto en los campos de **Peso (kg)**, **Volumen (m³)** y **Piezas** del formulario de editar embarque.

### Cambios propuestos

1. **Aplicar clases anti-spinner en `BloqueMercancia.tsx`**
   - Agregar la clase utilitaria Tailwind ya existente en el proyecto:
     `[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
   - Aplicarla a los tres `<Input type="number" />` de `pesoKg`, `volumenM3` y `piezas`.
   - Preservar la prop `className` combinada con `fieldErrorProps` para no perder el borde de error.

2. **Actualizar versionado y changelog**
   - Bump de `APP_VERSION` y entrada en `CHANGELOG.md` según las reglas del proyecto.

3. **Verificación visual (build + preview)**
   - Confirmar que los spinners desaparecen en los tres campos en la página de editar embarque.
   - Asegurar que no hay regresión de lint/typecheck/tests.

### Notas técnicas
- No se reemplaza el componente `Input` por `NumericInput` para mantener el comportamiento actual de `react-hook-form register` y evitar efectos secundarios no solicitados.
- Se usa el mismo patrón anti-spinner que ya existe en `src/features/costeo/components/TarifaNumerosVigenciaFields.tsx`, garantizando consistencia.

### Entregables
- `src/features/embarques/components/secciones/BloqueMercancia.tsx` modificado.
- `src/constants/appVersion.ts` y `CHANGELOG.md` actualizados.