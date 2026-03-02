

## Plan: Reemplazar Vigencia por Validez de la Propuesta — v3.12.1

### Cambios

#### `src/pages/NuevaCotizacion.tsx`

1. Eliminar el estado `vigenciaDias` y su campo `<Input>` de la sección inferior
2. Renombrar la Card de "Vigencia y Notas" a "Notas Adicionales"
3. Quitar el grid de 2 columnas, dejar solo el campo de `Textarea` para notas
4. En el objeto que se pasa a `crearCotizacion.mutateAsync()`, calcular `vigencia_dias` automáticamente a partir de `validezPropuesta` (diferencia en días desde hoy), o dejar un valor por defecto (15) si no se seleccionó fecha — así el campo de BD sigue recibiendo un valor válido sin que el usuario lo capture manualmente

#### `src/pages/CotizacionDetalle.tsx`

- Ya muestra `validez_propuesta` y `vigencia_dias`. Verificar que se sigan mostrando correctamente sin cambios adicionales.

#### `src/pages/Changelog.tsx` — Entrada v3.12.1

### Archivos
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/Changelog.tsx`

