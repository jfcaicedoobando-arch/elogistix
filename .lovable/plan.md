

## Mostrar expediente y contenedor en la misma línea

**Problema**: El contenedor se muestra en texto muy pequeño (`text-[10px]`) separado del expediente, difícil de leer.

**Solución**: Combinar expediente y contenedor en el título principal de la tarjeta, formato `ELIMP00149 - WHSU6049365`, y eliminar el contenedor duplicado de la fila inferior.

### Cambios en `src/pages/portal/PortalEmbarques.tsx`

1. **Línea 119** — Cambiar el título de la tarjeta:
   - De: `{e.expediente}`
   - A: `{e.expediente}{e.contenedor ? ` - ${e.contenedor}` : ""}`

2. **Líneas 125-130** — Eliminar el bloque del contenedor separado (el `{e.contenedor && (...)}`)

### Cambio en `src/pages/Changelog.tsx`
- Agregar entrada v8.0.5

### Archivos a modificar
- `src/pages/portal/PortalEmbarques.tsx` (2 ediciones)
- `src/pages/Changelog.tsx`

