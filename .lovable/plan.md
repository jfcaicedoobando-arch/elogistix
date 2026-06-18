## Problema
En `/cotizaciones/:id` coexisten dos controles que navegan al mismo destino (`/embarques/:id`):

1. **Botones "Ver {expediente}"** en la barra de acciones (`CotizacionDetalleAcciones`) — generan ruido visual cuando hay múltiples embarques.
2. **Tarjeta "Embarques Generados"** (`CotizacionDetalleEmbarques`) — lista rica con estado, fecha y navegación por click en la fila.

El usuario prefiere dejar solo la tarjeta.

## Cambios

### 1. `CotizacionDetalleAcciones` — simplificación
- Eliminar los botones de navegación a embarque (líneas ~113-117 del archivo actual).
- Eliminar import de `useNavigate` si queda sin uso.
- Eliminar props que solo servían para esos botones:
  - `embarqueIdVinculado: string | null`
  - `embarquesVinculados?: EmbarqueVinculado[]`
- Eliminar la lógica de `idsVinculados` y `hayVinculados` que armaba la lista para los botones.
- Ajustar la condición del botón "Crear embarque" para que siga apareciendo en `Aceptada` (sin embarques) sin depender de `hayVinculados`.

### 2. `CotizacionDetalle.tsx` — quitar props innecesarias
- Dejar de pasar `embarqueIdVinculado` y `embarquesVinculados` a `<CotizacionDetalleAcciones>`.

### 3. `CotizacionDetalleEmbarques` — sin cambios
- La tarjeta sigue siendo la única forma de ver y navegar a embarques generados.

## Verificación
- Abrir una cotización en estado "En operación" con 1+ embarques vinculados.
- Confirmar que NO hay botones "Ver ELIMPxxxxx" en la barra de acciones.
- Confirmar que la tarjeta "Embarques Generados" sigue mostrando los embarques y permite navegar al hacer click.
- Confirmar que el botón "Crear embarque" aún aparece cuando una cotización "Aceptada" no tiene embarques.

## Versionado
- `APP_VERSION` → siguiente patch.
- Entrada en `CHANGELOG.md` describiendo la simplificación.