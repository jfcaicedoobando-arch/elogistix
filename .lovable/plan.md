## Resumen
El **agente** y la **naviera** del embarque se heredarán automáticamente de la cotización vinculada. Ambos vienen de la tarifa marítima del módulo Costeo (`costeo_tarifas.agente_id`, `costeo_tarifas.naviera_id`). Se añaden `agente_id` y `naviera_id` como FKs en `cotizaciones` y `embarques`, se guardan al aplicar tarifa y se propagan al crear/editar embarque. Ambos serán editables en el embarque con banner de override.

## Alcance validado
- **Agente**: aplica a todos los modos, autollenado desde tarifa solo en Marítimo. FK a `costeo_agentes(id)`.
- **Naviera**: aplica solo a Marítimo (LCL/FCL). FK a `public.navieras(id)`. En Aéreo se mantiene `aerolinea` (texto), en Terrestre `transportista` (texto).
- Ambos campos son editables en el embarque; si el usuario cambia el valor heredado se muestra banner de override + botón "Restaurar desde cotización".

## Fases de implementación

### 1. Base de datos
- Migración añade columnas nullable en `public.cotizaciones`:
  - `agente_id uuid REFERENCES public.costeo_agentes(id) ON DELETE SET NULL`
  - `naviera_id uuid REFERENCES public.navieras(id) ON DELETE SET NULL`
- Migración añade las mismas dos columnas en `public.embarques`.
- Se conservan `embarques.naviera` (texto) y `embarques.agente` (texto) como legacy readonly para no romper filas históricas; se dejan sincronizados por trigger para búsquedas/exports.
- Actualizar `public.crear_embarque_borrador_core` para heredar `agente_id` y `naviera_id` desde la cotización, con fallback a `costeo_tarifas` si vienen nulos y la cotización tiene `tarifa_id`.
- Backfill opcional: para `cotizaciones` que ya tienen `tarifa_id`, poblar `agente_id`/`naviera_id` desde `costeo_tarifas`. Idem para `embarques` con `tarifa_id`.
- RLS: no requiere policies nuevas (ambas tablas ya las tienen); solo se garantiza GRANT vigente sobre las tablas alteradas.

### 2. Tipos y formulario de cotización
- Añadir `agenteId`, `agenteNombre`, `navieraId`, `navieraNombre` a `CotizacionFormValues` y `CotizacionInitialData`.
- Añadir `agente_id?` y `naviera_id?` a `CreateCotizacionInput`.
- Actualizar `aplicarTarifaAlForm` para setear los 4 campos desde `TopTarifaRow` (`agente_id`, `agente_nombre`, `naviera_id`, `naviera_nombre`).
- Actualizar mappers de persistencia de cotización (INSERT/UPDATE) para enviar `agente_id` y `naviera_id`.
- `TarifaVinculadaPanel` ya muestra agente; se añade línea con naviera.

### 3. Tipos y formulario de embarque
- Añadir `agenteId: string` y `navieraId: string` a `EmbarqueFormValues` + defaults.
- `mapEmbarqueRowToFormValues` hidrata `agenteId`/`navieraId` desde columnas nuevas, con fallback vacío.
- `buildEmbarquePayload`/`partesMaritimo` envía `agente_id` y `naviera_id` (y sigue enviando `agente`/`naviera` como texto derivado para compat).
- `CotizacionParaVincular` y `buildPackBUpdates` propagan ambos ids al vincular cotización.
- Snapshot de vincular respeta override para ambos campos al desvincular.

### 4. UI del wizard de embarque
- `AgenteEmbarqueSelector.tsx` (nuevo, ≤200 líneas): select con búsqueda sobre `fetchCosteoAgentes(orgId)`. Badge "Cotización" si es heredado; banner + botón "Restaurar desde cotización" si el usuario lo edita.
- `NavieraEmbarqueSelector.tsx` (nuevo, ≤200 líneas): mismo patrón sobre `public.navieras` (hook `useNavieras` si existe, si no crear fetcher simple). Solo se muestra en Marítimo.
- `StepDatosRutaMaritimo.tsx`: reemplaza el input libre de `agente` por `AgenteEmbarqueSelector`, y el de `naviera` por `NavieraEmbarqueSelector`.
- `ResumenHerenciaCotizacion.tsx`: agrega filas para agente y naviera heredados.

### 5. Guardado/Edición
- `useCreateEmbarque` y `useUpdateEmbarque` envían `agente_id` y `naviera_id` en el payload.
- La edición del embarque preserva ambos ids salvo cambio explícito del usuario.
- `crear_embarque_borrador_core` y `crear_embarque_borrador_desde_cotizacion` propagan ambos ids al borrador.

### 6. Tests y CI
- Unit: `aplicarTarifaAlForm` setea agente + naviera.
- Unit: mappers de embarque incluyen/hidratan `agente_id` y `naviera_id`.
- Unit: `buildVincularCotizacionUpdates` propaga ambos.
- Componente: selectors renderizan badge y restauran override.
- `bun run lint -- --max-warnings 0` + `bun run test`.
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

## Technical details
- `agente_id` FK → `public.costeo_agentes(id)` ON DELETE SET NULL, nullable.
- `naviera_id` FK → `public.navieras(id)` ON DELETE SET NULL, nullable.
- Selectores filtran por `activo = true` pero muestran igual el valor heredado si estuviera inactivo (evita "cero opciones").
- Orden de resolución al crear embarque desde cotización: `cotizaciones.agente_id`/`naviera_id` → si null y hay `tarifa_id`, `costeo_tarifas.*` → null.
- Se conserva el patrón `tarifaOverride` sumando claves `agenteId` y `navieraId` cuando se editan tras heredarlos.

## Notas de riesgo
- Filas históricas de `embarques` con `agente`/`naviera` como texto no se pueden mapear con seguridad a los catálogos → quedan con `agente_id`/`naviera_id` en null y el texto legacy visible; el usuario los completa al editar.
- Si la tarifa cambia de agente/naviera después de vincular, la cotización mantiene el snapshot original (no se re-sincroniza automáticamente); coherente con el patrón `tarifa_override` existente.
- Requiere confirmar que `public.navieras` tiene RLS `SELECT` para `authenticated` con scope global (la tabla es catálogo). Si no, se ajusta en la misma migración.