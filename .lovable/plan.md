# Quitar botón "Crear tarifa" del wizard de cotización

## Cambios

### `src/features/cotizacion/components/TarifaVinculadaPanel.tsx`
- Eliminar el botón `<Button>` con icono `Plus` que dispara `irACrearTarifa` dentro del bloque "Tarifa requerida para continuar" (sin tarifa vinculada).
- Eliminar la función `irACrearTarifa` y la dependencia `useNavigate` si queda huérfana.
- Eliminar imports no usados: `Plus`, `useNavigate`.
- El bloque queda con sólo el mensaje informativo + las sugerencias inline (`SugerenciasTarifaInline`). El alta de tarifas se hace exclusivamente desde el módulo Costeo.

### Versionado
- Bump `APP_VERSION` → `13.47.3`.
- Entrada en `CHANGELOG.md`: "Quitar botón 'Crear tarifa' del wizard — el alta de tarifas se hace exclusivamente desde el módulo Costeo".

## Fuera de alcance
- Cambios en el módulo Costeo (`/costeo/tarifas`).
- Cambios en `SugerenciasTarifaInline` ni `BuscarTarifaDialog`.
