## Resumen
Simplificar el selector de filas por pagina en la tabla de embarques: eliminar las opciones 10, 20 y 50, dejar solo **100 datos por pagina** y **Todos**. El default sera 100.

## Cambios necesarios

### 1. PaginationControls (componente compartido)
- Cambiar `DEFAULT_OPTIONS` de `[10, 20, 50]` a `[100]`.
- Agregar soporte para labels personalizados via prop `pageSizeLabels?: Record<number, string>`.
- El Select renderizara el label personalizado si existe (ej: `999999 -> "Todos"`), de lo contrario el numero + "/ pag".

### 2. useEmbarquesFilters (hook de estado)
- Cambiar `DEFAULT_PAGE_SIZE` de `20` a `100`.

### 3. Embarques.tsx (pagina)
- Pasar `pageSizeOptions={[100, 999999]}` al `DataTable`.
- Pasar `pageSizeLabels={{ 999999: "Todos" }}` para que el Select muestre "Todos".

### 4. useEmbarquesPageState (logica de datos)
- Detectar cuando `pageSize === 999999` (modo "Todos").
- En Rama A (sin filtro de estado): en lugar de `useEmbarquesPaginados`, usar `fetchEmbarquesParaExport` (ya trae todo en chunks de 1000) + `fetchEmbarquesListExtras` para los IDs visibles. Esto unifica el comportamiento con la Rama B.
- `totalPages = 1` cuando esta en modo "Todos".
- `filtered` muestra todo el set sin slice de paginacion.

### 5. DataTablePagination (tipo)
- Agregar `pageSizeLabels?: Record<number, string>` a la interfaz.

## Notas tecnicas
- No se modifica el RPC `embarques_listado` ni la BD.
- `fetchEmbarquesParaExport` ya existe y maneja el loteo interno para superar el limite de 1000 filas de Supabase.
- La Rama B (con filtro de estado) ya trae todo el set; el modo "Todos" simplemente mostrara el slice completo sin paginar.
- Se actualizaran `CHANGELOG.md` y `APP_VERSION`.