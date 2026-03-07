

## Plan: Estandarizar Tablas con Componente Reutilizable (v4.30.0)

### Resumen
Crear un componente `DataTable` reutilizable que centralice loading, empty state, zebra-striping, hover marcado, sticky headers y densidad compacta. Actualizar las 4 mejoras en el componente base `ui/table` y migrar las 9+ tablas de la app al nuevo componente.

---

### 1. Mejoras al componente base `src/components/ui/table.tsx`

Actualizar las clases CSS de los primitivos:

- **TableHeader**: agregar `sticky top-0 z-10 bg-background` para sticky headers
- **TableRow**: agregar `even:bg-muted/20` (zebra), mejorar hover a `hover:bg-primary/5` con `transition-colors duration-150`
- **TableHead**: reducir altura de `h-11` a `h-9`, reducir padding
- **TableCell**: reducir padding de `px-4 py-3` a `px-3 py-2`

### 2. Nuevo componente `src/components/DataTable.tsx`

Componente wrapper reutilizable con esta API:

```typescript
interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  skeletonRows?: number;
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
}
```

Funcionalidad incluida:
- **Loading**: renderiza N filas de `Skeleton` automáticamente
- **Empty state**: mensaje centrado con icono opcional
- **Filas clickeables**: `cursor-pointer` automático si `onRowClick` existe

### 3. Migración de tablas existentes (9 archivos)

Cada tabla se migra al nuevo `DataTable`, eliminando código repetitivo de skeletons y empty states:

| Archivo | Tipo |
|---------|------|
| `Embarques.tsx` | Listado principal |
| `Cotizaciones.tsx` | Listado principal |
| `Clientes.tsx` | Listado principal |
| `Facturacion.tsx` | Listado principal |
| `Proveedores.tsx` | Listado por tabs |
| `Usuarios.tsx` | Admin |
| `EmbarquesActivosTable.tsx` | Dashboard |
| `ProfitTable.tsx` | Dashboard |
| `TabPuertos.tsx` | Configuración |

Las tablas de detalle (TabDocumentos, TabFacturacion, TabCostos, TabResumen, TablaConceptosGenerico, DialogDuplicarEmbarque) mantienen el uso directo de primitivos `Table/*` ya que tienen estructuras más especializadas, pero se benefician de las mejoras CSS del paso 1.

### 4. Changelog

Nueva entrada v4.30.0 documentando la estandarización.

---

### Resultado esperado
- Zebra-striping en todas las tablas
- Hover con tinte primary sutil y transición suave
- Headers fijos al scroll
- Filas ~20% más compactas
- Loading y empty states unificados en las tablas principales
- ~30-50 líneas eliminadas por cada tabla migrada

