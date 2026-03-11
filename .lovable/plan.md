

## Fix: Formato de timestamp en Notas y Actividad

**Problema**: `TabNotas` usa `formatDate()` que solo maneja fechas `YYYY-MM-DD` y no muestra hora. Los timestamps de notas son ISO completos (ej: `2026-03-10T14:30:00Z`).

**Solución**: Reemplazar `formatDate(nota.fecha)` con una función de formato local que muestre fecha y hora legible según el estándar del proyecto (`DD/MM/YYYY, HH:mm`).

### Cambios

1. **`src/components/embarque/TabNotas.tsx`** (línea ~76):
   - Reemplazar `formatDate(nota.fecha)` por un formato usando `new Date(nota.fecha).toLocaleString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })` o bien usar `format` de `date-fns` con locale es-MX.
   - Remover import de `formatDate` si ya no se usa.

Solo se toca este archivo.

