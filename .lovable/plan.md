## Contexto

El stepper del detalle del embarque muestra `Borrador → Cotización → Confirmado → …` porque así está el enum `estado_embarque` en la base de datos y la máquina de transiciones. El problema es de **nomenclatura**: "Cotización" también es el nombre del documento previo (COT-2026-XXXX) que genera el embarque, así que ver "Paso 2: Cotización" después de "Borrador" da la impresión de que el embarque retrocede a la cotización.

Solución acordada: **cambio cosmético**. La base de datos, el enum, las policies y la máquina de estados siguen usando el valor `'Cotización'`. Solo cambia lo que ve el usuario: la etiqueta pasa a **"Propuesta"**.

## Cambios

### 1. Nuevo mapa de etiquetas visibles
Crear `src/features/embarques/constants/estadoEmbarqueLabels.ts`:

- Exporta `ESTADO_EMBARQUE_LABELS: Record<EstadoEmbarque, string>` con `'Cotización' → 'Propuesta'` y el resto igual.
- Exporta helper `labelEstadoEmbarque(estado)` que hace fallback al valor original si no está mapeado.

### 2. Consumir el mapa en los puntos donde el usuario lee el estado

- `src/features/embarques/components/tabResumen/EstadoProgresoCard.tsx` — nombres del stepper y del "Siguiente".
- `src/lib/ui/estadoConfig.ts` (entrada `"Cotización"`) — badge del listado y del header.
- `src/features/embarques/domain/embarqueFases.ts` (línea 83) — label de la fase.
- Filtros/selects de estado del listado de embarques y del tab Tracking (se identifican durante la implementación buscando iteraciones sobre `ESTADOS_EMBARQUE`).
- Leyendas del dashboard donde se muestre la clave `"Cotización"` como texto (los `Record` que usan la clave como *dato* no se tocan, solo el render).

### 3. Header del detalle
En `EmbarqueDetalleHeader.tsx`, la línea "Cotización origen: COT-…" se mantiene tal cual (ahí sí se refiere al documento previo, no al estado). Sin cambios.

### 4. Tests

- Ajustar snapshots/expectativas que asertaban el string `'Cotización'` como etiqueta visible del estado del embarque (los que asertan el valor de BD siguen igual).
- Añadir test unitario para `labelEstadoEmbarque('Cotización') === 'Propuesta'` y que el resto de estados no cambia.

### 5. Versión y changelog

- `APP_VERSION` → `13.303.17`.
- Entrada en `CHANGELOG.md` explicando el renombrado cosmético y que la BD no cambia.

## Detalles técnicos

- **No se toca** el enum `estado_embarque`, la RPC de transiciones, RLS ni el parser del dashboard (`dashboardTypes.ts`, `dashboard.ts`) porque usan `"Cotización"` como *clave de dato*, no como texto visible.
- Riesgo: bajo. Es un cambio de presentación. El único riesgo real es que un filtro compare el label visible en vez del valor; el barrido en el paso 2 lo previene.
- Al terminar: `bun run lint` + `bun run typecheck` + tests de embarques.

## Fuera de alcance

- Renombrar el enum en BD.
- Eliminar el paso del flujo o reordenarlo.
- Cambios en el módulo de Cotizaciones (documento COT).
