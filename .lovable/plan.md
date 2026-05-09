# Fallback de ETD desde `last_movement_timestamp` cuando `atd_origin` viene null

## Diagnóstico

Para el contenedor BEAU6309761 (EVERGREEN) JSONCargo está devolviendo:

```
atd_origin: null
last_movement_timestamp: "2026-04-28 00:00"
timestamp_of_last_location: "2026-04-28 00:00"
container_status: "Loaded (FCL) on vessel"
last_location: "SHANGHAI (CN)"
last_vessel_name: "SHANGHAI", last_voyage_number: "119E"
```

`deriveEventsFromContainer` genera correctamente un evento (clasificado como "Transbordo" porque `discharging_port` es null) con la fecha 2026-04-28. Por eso la **línea de tiempo sí muestra esa fecha** como movimiento de carga en Shanghai.

Pero `TrackingLiveCard` y el cálculo de `etd_propuesta` en la edge function leen únicamente `summary.atd_origin`, que viene null → el panel "ETD origen (JSONCargo)" muestra `—` y nunca aparece propuesta de actualizar la ETD del embarque.

## Solución

Agregar un fallback: cuando `atd_origin` sea null pero el contenedor ya esté cargado en el buque (status tipo "Loaded ... on vessel" o "Departed ..."), usar `last_movement_timestamp` (con fallback a `timestamp_of_last_location`) como ETD efectivo.

### 1. `supabase/functions/jsoncargo-track/index.ts`
Reemplazar el cálculo de `etdPropuesta` por un helper compartido:

```ts
const etdEffective = pickEffectiveEtd(result.data); // string | null en formato JSONCargo
const newEtdIso = parseJsonCargoDate(etdEffective);
```

`pickEffectiveEtd` (a colocar en `supabase/functions/_shared/jsoncargo.ts` y exportar):

```ts
export function pickEffectiveEtd(d: JsonCargoContainerData): string | null {
  if (d.atd_origin) return d.atd_origin;
  const status = (d.container_status ?? "").toLowerCase();
  const looksDeparted = /loaded.*vessel|on vessel|departed|in transit|sail/.test(status);
  if (looksDeparted) {
    return d.last_movement_timestamp ?? d.timestamp_of_last_location ?? null;
  }
  return null;
}
```

Incluir en `summary` un nuevo campo `etd_origin_effective` (la cadena ya elegida) y mantener `atd_origin` tal cual viene de JSONCargo, para no confundir el dato crudo.

### 2. `src/hooks/embarque/useJsonCargoTracking.ts`
- Extender `JsonCargoSummary` con `etd_origin_effective?: string`.
- En `extractSummary`, calcular el mismo fallback en frontend (usando `last_movement_timestamp`/`timestamp_of_last_location`/`container_status`) para que tras un refresh la card siga mostrando la propuesta sin necesidad de re-sincronizar. Reusar la misma heurística regex.

### 3. `src/components/embarque/TrackingLiveCard.tsx`
- En el bloque de propuesta de fechas y en el campo "ETD origen (JSONCargo)" del grid, usar `summary.etd_origin_effective ?? summary.atd_origin`.
- Si la fecha proviene del fallback (no de `atd_origin`), agregar un sufijo discreto "(estimado)" o un tooltip explicando que se infirió de la última carga en buque.

## Verificación

Para el embarque actual (ETD embarque = 2026-04-28, JSONCargo `atd_origin` null):
- Antes del fix: ETD origen aparece "—" y no hay propuesta de actualización.
- Después del fix: ETD origen aparece "28 abr 2026 (estimado)" y, como coincide con la ETD del embarque, **no** se muestra la tarjeta de propuesta — correcto.

Para un embarque cuya ETD del embarque fuera distinta a `last_movement_timestamp`, la tarjeta de propuesta debería ofrecer actualizar.

## Versionado

- `APP_VERSION` → `8.133.1`
- Nueva entrada en `chunk0.ts` y `recentChangelog`.

## Fuera de alcance

- No se modifica `deriveEventsFromContainer` (los eventos siguen igual).
- El warning de "Maximum update depth exceeded" en `EmbarqueDetalle` viene de `useRegisterBreadcrumbLabel` y es preexistente — no se aborda aquí.
