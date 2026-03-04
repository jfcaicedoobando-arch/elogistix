

## Plan: DROP y recrear tabla `cotizacion_costos`

### Migración SQL
1. `DROP TABLE public.cotizacion_costos;` — elimina la tabla actual y todos sus datos
2. `CREATE TABLE public.cotizacion_costos` con la nueva estructura:
   - `id`, `cotizacion_id` (FK → cotizaciones), `concepto`, `moneda` (CHECK USD/MXN), `proveedor`, `cantidad`, `costo_unitario`, `costo_total` (GENERATED ALWAYS AS cantidad * costo_unitario STORED)
   - `created_at`, `updated_at`
3. Habilitar RLS + mismas 2 políticas (admin/operador CRUD, viewer SELECT)
4. Índice en `cotizacion_id`

### Código a actualizar después de la migración
- **`src/hooks/useCotizacionCostos.ts`** — actualizar interfaces y queries para usar las nuevas columnas (`cantidad`, `costo_unitario`, `costo_total`) y eliminar las obsoletas (`venta`, `profit`, `porcentaje_profit`, `seccion`, `unidad_medida`)
- **`src/components/cotizacion/SeccionCostosInternosCotizacion.tsx`** — adaptar el formulario a la nueva estructura (quitar campos venta/sección, agregar cantidad/costo unitario, mostrar costo total calculado)
- **`src/pages/Changelog.tsx`** — nueva entrada

**Nota:** Esta migración eliminará todos los datos existentes en `cotizacion_costos`. Los datos no son recuperables.

