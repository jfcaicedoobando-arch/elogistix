

## Fase 1: Eliminar SeccionCostosInternosCotizacion

### Hallazgos
- `SeccionCostosInternosCotizacion.tsx` no se importa en ningún otro componente/página — solo existe el archivo y una referencia en Changelog.
- Changelog entry en líneas 693-700 (v4.5.2) referencia el componente.

### Cambios

1. **Eliminar** `src/components/cotizacion/SeccionCostosInternosCotizacion.tsx`

2. **Changelog.tsx** (líneas 693-700): Actualizar el título y descripción de la entrada v4.5.2 para que no mencione el componente eliminado. Cambiar a algo como "Costos internos por cotización" con descripción genérica sobre la funcionalidad de P&L.

3. **Changelog.tsx**: Agregar entrada v4.37.2 al inicio del array con título "Limpieza: eliminar componente legacy de costos internos" indicando que se removió el componente no utilizado `SeccionCostosInternosCotizacion` reemplazado por `SeccionCostosInternosPLUnificado`.

