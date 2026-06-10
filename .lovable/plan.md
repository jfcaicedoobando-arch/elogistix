## Objetivo

Simplificar el módulo de Costeo para que las tarifas marítimas se manejen únicamente por **tipo de contenedor FCL** (20', 40', 45' High Cube, 53' High Cube). Se excluye LCL de este módulo: tendrá su propio proceso (fuera del alcance de este plan). La tarifa cargada aplica a un contenedor de ese tipo y se multiplica por la cantidad de contenedores del embarque/cotización.

## Cambios

### 1. Catálogo `tipos_contenedor` (BD)
Migración para dejar activos únicamente los 4 tipos canónicos:
- `20'` (Standard)
- `40'` (Standard)
- `45' High Cube`
- `53' High Cube`

Lógica:
- `UPDATE tipos_contenedor SET activo = false` para todos los demás (no borrar para preservar histórico de embarques/cotizaciones que ya los referencian).
- `INSERT … ON CONFLICT DO NOTHING` de los 4 canónicos si no existen.
- Añadir columna `activo boolean default true` si aún no existe (verificar primero).

### 2. Selector de tipo en módulo Costeo
Filtrar `useTiposContenedor` (o consumir un nuevo `useTiposContenedorFCL`) para que en:
- `src/features/costeo/routes/CosteoBuscar.tsx` (selector "Tipo contenedor")
- Formulario de captura de tarifa (`src/features/costeo/components/...` editor de `costeo_tarifas`)
- Formulario de captura de demoras de naviera

sólo aparezcan los 4 tipos activos. El resto del sistema (embarques, contenedores existentes) sigue leyendo el catálogo completo para no romper datos históricos.

### 3. Exclusión de LCL en Costeo
- Quitar cualquier opción/branch de LCL en los formularios de tarifa marítima del módulo Costeo.
- Si existe alguna ruta/menú de "Costeo LCL", ocultarla.
- No tocar la lógica de LCL existente en embarques (`mem://features/shipment-lcl-logic`) — sólo se excluye del flujo de tarifas.

### 4. Aplicación tarifa × cantidad
Verificar en los consumidores de `get_top_tarifas` / `TarifaResultCard` que:
- La tarifa se muestra como precio unitario por contenedor del tipo seleccionado.
- Al convertir a costo de embarque/cotización (`mapCostosACostosEmbarque` y similares), el monto se multiplique por la cantidad de contenedores de ese tipo del embarque.
- Documentar el cambio en la card de resultado: subtítulo "Precio por contenedor".

### 5. Versionado y memoria
- Bump `APP_VERSION` a `12.77.0` (cambio de comportamiento).
- Entrada en `CHANGELOG.md`: simplificación Costeo, 4 tipos FCL, exclusión LCL.
- Actualizar `mem://features/costeo-tarifas-maritimas` con la nueva regla (4 tipos, sin LCL, precio×cantidad).

## Detalle técnico

Archivos previstos a tocar:
- `supabase/migrations/<nueva>.sql` — desactivar tipos no canónicos + asegurar los 4.
- `src/hooks/catalogos/...` (o donde viva `useTiposContenedor`) — nuevo hook `useTiposContenedorFCL` que filtra `activo = true AND name IN (...)`.
- `src/features/costeo/routes/CosteoBuscar.tsx` — usar nuevo hook.
- Editor de tarifas en `src/features/costeo/components/` (TBD al implementar) — mismo cambio.
- `src/features/costeo/components/TarifaResultCard.tsx` — etiqueta "Precio por contenedor".
- Consumidor de tarifa al armar embarque/cotización — aplicar × cantidad si no lo hace ya.
- `src/constants/appVersion.ts`, `CHANGELOG.md`.

Fuera de alcance:
- Nuevo proceso detallado de LCL (se planeará por separado cuando el usuario lo solicite).
- Migración masiva de tarifas históricas con tipos no canónicos: se conservan tal cual (sólo dejan de ofrecerse para captura nueva).

## Validación
- Captura nueva de tarifa: el selector muestra sólo los 4 tipos.
- `CosteoBuscar` lista los 4 tipos.
- Una tarifa existente con tipo legado sigue visible en históricos pero no se puede re-seleccionar al capturar nueva.
- Cotización/embarque con 3 contenedores 40' aplica tarifa × 3.
