

## Plan: Optimizar tabla de Embarques para aprovechar mejor la pantalla

### Problema
- `PAGE_SIZE` está hardcodeado a 10, desperdiciando espacio en monitores grandes.
- 11 columnas fijas sin adaptación responsive.

### Cambios propuestos

**1. `src/pages/Embarques.tsx`**
- Aumentar `PAGE_SIZE` de 10 a 20 para mostrar más registros por defecto.
- Agregar opción de seleccionar registros por página (10 / 20 / 50) junto al control de paginación.

**2. `src/components/PaginationControls.tsx`**
- Agregar prop opcional `pageSize` + `onPageSizeChange` para renderizar un selector de "registros por página".

**3. `src/pages/Changelog.tsx`**
- Entrada v4.27.0.

### Sin cambios en
- La estructura de columnas se mantiene (son operativamente necesarias).
- El componente `Table` base no cambia.

