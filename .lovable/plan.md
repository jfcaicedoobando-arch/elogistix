
# Plan: Vincular tarifa de Costeo con Paso 1 de Cotización

## Objetivo

Eliminar la doble captura (y los desajustes) entre lo que el vendedor promete al cliente y lo que la tarifa del proveedor realmente cubre. La tarifa pasa a ser la fuente de verdad para tránsito, días libres y carta garantía en cotizaciones marítimas FCL/LCL.

## UX propuesta

### 1. Buscador de tarifa en el Paso 1 (no en Paso 2)

Cuando `modo = Marítimo` y ya hay origen + destino + tipo de contenedor capturados, aparece un panel destacado arriba de "Ruta":

```text
┌─ Tarifa marítima ─────────────────────────────┐
│  [ 🔍 Buscar tarifa Costeo ]                  │
│                                                │
│  ✓ Maersk · Shanghai → Manzanillo · 40HC      │
│    Agente: COSCO MX · vigente hasta 30/07/26  │
│    USD 2,450 + 4 recargos                     │
│    [Cambiar tarifa] [Quitar vínculo]          │
└────────────────────────────────────────────────┘
```

Al elegir tarifa:
- Se guarda `cotizacion.tarifa_id` (nueva FK opcional a `costeo_tarifas`).
- Se autollenan en el form RHF:
  - `tiempoTransitoDias` ← `tarifa.transit_time_dias`
  - `diasLibresDestino` ← `tarifa.dias_libres_demoras`
  - `cartaGarantia` ← derivado del estado de `costeo_navieras_condiciones` (vigente/por vencer = true; vencida/sin carta = false).
- Los inputs quedan **readonly con badge** "Origen: tarifa Maersk" y un botón "Editar manualmente" que rompe el vínculo (override explícito, marcado como `tarifa_override = true` para auditoría).

### 2. Estado real de la carta garantía

Reemplazar el toggle Sí/No por un indicador derivado:

```text
Carta garantía:  🟢 Vigente hasta 15/08/26 (Maersk · COSCO MX)
                 🟡 Por vencer en 12 días
                 🔴 Vencida desde 02/05/26 — se cobrará depósito
                 ⚪ Sin carta — se cobrará depósito
```

- Componente nuevo `CartaGarantiaBadge` que lee `costeo_navieras_condiciones` por `(naviera_id, proveedor_id)` de la tarifa elegida.
- Reutiliza `calcularEstadoCartaGarantia()` que ya existe en `src/features/costeo/types/navieraCondicion.ts`.
- Si no hay tarifa elegida todavía: se muestra el toggle manual actual como fallback.

### 3. Paso 2 (Costos) — simplificado

- Quitar el botón "Buscar tarifa Costeo" de `SeccionCostosInternosPLLocal.tsx`.
- Si en Paso 1 ya hay tarifa vinculada, el Paso 2 abre con flete + recargos precargados automáticamente (misma lógica de `aplicarTarifaCosteo` actual).
- Se mantiene la opción "Agregar costo manual" para extras.
- Banner informativo arriba: "Costos precargados desde tarifa Maersk · [Ver tarifa] [Cambiar]".

### 4. Re-validación al cambiar tarifa o ruta

- Si el usuario cambia origen/destino/tipoContenedor después de haber elegido tarifa → modal de advertencia: "La tarifa ya no coincide con la nueva ruta. ¿Quitar vínculo?".
- Si la tarifa vinculada vence antes de `validezPropuesta` → warning inline (no bloqueante): "La tarifa vence el DD/MM/YYYY, antes de la validez ofrecida al cliente".

## Cambios técnicos

### Base de datos (1 migración)

```sql
ALTER TABLE public.cotizaciones
  ADD COLUMN tarifa_id uuid REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN tarifa_override jsonb DEFAULT '{}'::jsonb;
-- tarifa_override guarda qué campos fueron editados manualmente, ej:
--   { "tiempoTransitoDias": true, "diasLibresDestino": false }
CREATE INDEX idx_cotizaciones_tarifa_id ON public.cotizaciones(tarifa_id);
```

### Frontend

| Archivo | Cambio |
|---|---|
| `src/features/cotizacion/components/TarifaVinculadaPanel.tsx` | **NUEVO** — panel del Paso 1 con buscador y resumen de tarifa |
| `src/features/cotizacion/components/CartaGarantiaBadge.tsx` | **NUEVO** — indicador de estado real |
| `src/features/cotizacion/hooks/useTarifaVinculada.ts` | **NUEVO** — carga tarifa + condición naviera, sincroniza RHF con override tracking |
| `src/features/cotizacion/components/PasoDatosGenerales.tsx` | Insertar `<TarifaVinculadaPanel>` antes de `SeccionRutaCotizacion` |
| `src/features/cotizacion/components/SeccionRutaCotizacion.tsx` | Inputs de tránsito/días libres/carta garantía: readonly cuando hay tarifa, badge de origen, botón "editar manualmente" |
| `src/features/cotizacion/components/SeccionCostosInternosPLLocal.tsx` | Quitar botón "Buscar tarifa"; auto-precargar al montar si hay `tarifa_id`; banner de tarifa vinculada |
| `src/features/cotizacion/types/form.ts` | Añadir `tarifaId: string \| null` y `tarifaOverride: Record<string, boolean>` |
| `src/features/cotizacion/services/mutations/payloadBuilders.ts` | Persistir `tarifa_id` y `tarifa_override` |
| `src/lib/mappers/cotizacion.ts` | Incluir nuevos campos en `buildPaso1Data` |

### Pendientes de borrado

- Botón "Buscar tarifa Costeo" en `SeccionCostosInternosPLLocal.tsx` (líneas 87-91).

## Validaciones automáticas (sin bloquear)

- ⚠ Tarifa vence antes de `validezPropuesta`.
- ⚠ Carta garantía vencida o por vencer en <30 días.
- ⚠ Usuario sobrescribió `diasLibresDestino` con valor mayor al de la tarifa (riesgo comercial).

## Pruebas

- `useTarifaVinculada.test.ts` — autollenado, override tracking, cambio de tarifa.
- `CartaGarantiaBadge.test.tsx` — 4 estados.
- Test de integración: elegir tarifa en Paso 1 → avanzar a Paso 2 → costos precargados → guardar → BD tiene `tarifa_id`.

## Changelog y memoria

- `CHANGELOG.md` + bump `APP_VERSION` (sección "Cotizaciones · vínculo con tarifa").
- Nueva memoria `mem://features/cotizacion-tarifa-vinculada` resumiendo la regla "tarifa manda, override explícito".

## Fuera de alcance

- Conversión cotización → embarque (sigue igual; ya hereda `cotizacion_costos`).
- Edición de tarifas desde el wizard.
- Cotizaciones aéreas y terrestres (este plan aplica solo a marítimo FCL/LCL).
