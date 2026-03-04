

## Plan: Crear `SeccionCostosInternosCotizacion.tsx`

### Componente nuevo: `src/components/cotizacion/SeccionCostosInternosCotizacion.tsx`

**Props**: `cotizacionId: string`, `conceptosVenta: ConceptoVentaCotizacion[]`

**Comportamiento**:

1. **Visibilidad**: Usa `usePermissions()` — si `!canEdit`, retorna `null`
2. **Pre-poblado**: Al montar, si no hay costos guardados en BD (`useCotizacionCostos` retorna vacío), genera filas iniciales desde `conceptosVenta` mapeando `descripcion → concepto` y `precio_unitario * cantidad → venta`
3. **Estado local**: Array de filas editables con campos: concepto, proveedor, moneda (default `USD`), unidad_medida, costo, venta, seccion
4. **Columnas calculadas en UI**: `profit = venta - costo`, `% profit = ((venta - costo) / venta) * 100`
5. **Selector de sección**: Select con opciones `Origen`, `Flete Internacional`, `Destino`, `Otro`
6. **Botón Agregar**: Añade fila vacía al array local
7. **Botón Eliminar**: Por fila, llama `useDeleteCosto` si tiene id, o elimina del array local
8. **Botón Guardar**: Llama `useUpsertCostos()` con todo el array, asignando `cotizacion_id`
9. **Resumen P&L**: Usa `calcularPL()` para mostrar totales al pie de la tabla

### UI

- Card con título "Costos Internos (P&L)"
- Tabla con Table/TableRow/TableCell existentes
- Inputs inline para edición
- Footer con totales de costo, venta, profit y % profit

### Changelog

Registrar como versión **4.5.2**.

