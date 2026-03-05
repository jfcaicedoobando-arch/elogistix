

## Plan: Migración SQL con 3 cambios de esquema

Crear una única migración que ejecute:

1. `cotizaciones` — agregar `num_contenedores integer NOT NULL DEFAULT 1`
2. `embarques` — agregar `cotizacion_id uuid REFERENCES cotizaciones(id) ON DELETE SET NULL`
3. `cotizacion_costos` — agregar `precio_venta`, `precio_total` (generated), `profit` (generated), `porcentaje_profit` (generated), `unidad_medida`

### Archivos a modificar
- Nueva migración SQL (único archivo)
- `src/pages/Changelog.tsx` — entrada v4.9.3

No se toca ningún otro archivo ni tabla existente.

