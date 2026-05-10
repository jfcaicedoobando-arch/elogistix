# Fallback ZIM con Firecrawl

## Objetivo

Cuando la naviera del embarque sea **ZIM** (ZIMU), no depender de JSONCargo (que frecuentemente no encuentra contenedores ZIM) y en su lugar consultar directamente `https://www.zim.com/es/tools/track-a-shipment` usando el connector **Firecrawl**. El resultado debe alimentar `tracking_externo`, `eventos_embarque` y la tarjeta de "Tracking en vivo" igual que JSONCargo.

## Alcance

- Detección automática: si `embarque.naviera` mapea a ZIM, el botón "Sincronizar tracking" usa el flujo ZIM en lugar de JSONCargo.
- Persistencia compatible: se reutiliza `tracking_externo` con `provider = 'zim_scrape'` para no romper el panel actual.
- Resumen completo: status, ubicación, vessel, voyage, ETA destino, ATD origen, last_updated, y derivar eventos de timeline.
- Propuesta de ETA/ETD igual que hoy (la UI ya pregunta antes de actualizar fechas del embarque).

## Cambios

### 1. Connector y secret

- Conectar **Firecrawl** vía `standard_connectors--connect` (connector_id: `firecrawl`). Inyecta `FIRECRAWL_API_KEY` en las edge functions.
- No requiere migración ni cambios de auth.

### 2. Nueva edge function `zim-track`

`supabase/functions/zim-track/index.ts`:

1. Auth con JWT (igual patrón que `jsoncargo-track`, usando `_shared/auth.ts`).
2. Lee el embarque con `anonClient` (RLS) y valida que `modo = Marítimo`, que tenga `contenedor` o `bl_master`, y que la naviera mapee a ZIM.
3. Throttle 10 min contra `tracking_externo.last_synced_at` (provider `zim_scrape`).
4. Llama a Firecrawl `scrape` v2 contra `https://www.zim.com/es/tools/track-a-shipment?consnumber=<contenedor>` con:
   - `formats: [{ type: 'json', schema: ZIM_SCHEMA }, 'markdown']`
   - `onlyMainContent: true`, `waitFor: 4000` (ZIM renderiza con JS).
   - `location: { country: 'US', languages: ['en'] }` (la versión EN es más estable que la /es/).
5. Si Firecrawl devuelve éxito, guarda `raw_payload` con `{ source: 'zim', url, json, markdown }` y status `ok`. Si no hay match (json vacío), status `failed` con `failed_reason = 'ZIM no devolvió datos'`.
6. Deriva eventos de timeline a partir del array `events` extraído (ver schema), idempotente por `tipo|fechaTruncadaMinuto` con `usuario = 'zim_scrape'`.
7. Construye `summary` con el mismo shape que JSONCargo (`container_status`, `last_location`, `current_vessel`, `current_voyage`, `eta_final_destination`, `atd_origin`, `etd_origin_effective`, `etd_origin_is_estimated`, `shipped_from`, `shipped_to`, `last_updated`, `eta_propuesta`, `etd_propuesta`, `eta_difiere`, `etd_difiere`).
8. Reutiliza `pickEffectiveEtd` de `_shared/jsoncargo.ts` (acepta un objeto plano con esos campos).

### 3. Schema de extracción JSON para Firecrawl

```ts
const ZIM_SCHEMA = {
  type: 'object',
  properties: {
    container_number: { type: 'string' },
    container_status: { type: 'string', description: 'Estado actual del contenedor' },
    last_location: { type: 'string' },
    last_updated: { type: 'string', description: 'ISO date si es posible' },
    current_vessel: { type: 'string' },
    current_voyage: { type: 'string' },
    shipped_from: { type: 'string' },
    shipped_to: { type: 'string' },
    atd_origin: { type: 'string', description: 'ISO date de zarpe real' },
    eta_final_destination: { type: 'string', description: 'ISO date de ETA destino' },
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'ISO date' },
          tipo: { type: 'string', description: 'gate_in / loaded / departed / arrived / discharged / gate_out' },
          descripcion: { type: 'string' },
          ubicacion: { type: 'string' },
        },
        required: ['fecha', 'descripcion'],
      },
    },
  },
};
```

### 4. Hook + UI

`src/hooks/embarque/useZimTracking.ts` (nuevo, espejo de `useJsonCargoTracking`):

- `useZimTracking(embarqueId)` → query a `tracking_externo` filtrando por `provider = 'zim_scrape'`.
- `useSyncZim()` → `supabase.functions.invoke('zim-track', { body: { embarqueId } })`.
- `extractSummary(raw)` lee `raw.data.json` y devuelve `JsonCargoSummary` (mismo tipo, reutilizado).

`src/lib/jsoncargo/navieras.ts`:

- Exportar helper `isZimNaviera(naviera): boolean` (ya hay regex que detecta `zim`).

`src/components/embarque/TrackingLiveCard.tsx`:

- Si `isZimNaviera(embarque.naviera)`, usar `useZimTracking` + `useSyncZim` en lugar de los hooks JSONCargo.
- Mostrar pequeño badge "Fuente: ZIM.com" para diferenciar visualmente.
- Misma propuesta de aplicar ETA/ETD vía `useApplyJsonCargoFechas` (ya genérico).

`src/components/embarque/TabTracking.tsx`:

- Selecciona automáticamente el flujo ZIM o JSONCargo según naviera. Sin cambios visibles para el usuario salvo la fuente.

### 5. Versionado y changelog

- `APP_VERSION` → `8.135.0` (minor: nueva integración).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Tracking automático para ZIM vía zim.com cuando JSONCargo no tiene datos".

## Detalle técnico

```text
Sync tracking (botón en TrackingLiveCard)
        │
        ▼
 ¿naviera = ZIM?  ── sí ──▶ invoke('zim-track')
        │                        │
        no                       ▼
        │                 Firecrawl scrape (json + markdown)
        ▼                        │
 invoke('jsoncargo-track')       ▼
                          upsert tracking_externo
                          insert eventos_embarque
                          → summary + propuesta ETA/ETD
```

## Verificación

1. Embarque ZIMU con contenedor real → botón "Sincronizar" llama a `zim-track`; `tracking_externo` queda con `provider = 'zim_scrape'`, status `ok`, eventos creados.
2. Embarque ZIMU con contenedor inválido → `failed_reason = 'ZIM no devolvió datos'`, sin eventos.
3. Embarque MAERSK sigue usando JSONCargo (no se toca su flujo).
4. La propuesta de actualizar ETA/ETD aparece y al aceptarla, `etd_original`/`eta_original` quedan intactos (badge `+Nd`).
5. Throttle: segundo clic en < 10 min devuelve `throttled: true`.

## Fuera de alcance

- Sync batch nocturno para ZIM (se puede agregar luego, espejando `jsoncargo-track-batch`).
- Otras navieras no soportadas por JSONCargo (Wan Hai, ANL, etc.) — el catálogo `externalTracking.ts` ya ofrece link manual.
- Cambiar el esquema de `tracking_externo` (se aprovecha el campo `provider` existente).
- Tracking público / portal cliente.

## Riesgos y mitigaciones

- **Firecrawl créditos**: cada sync consume 1 crédito. El throttle de 10 min + sync manual (no automático) lo mantiene controlado.
- **ZIM cambia el HTML**: como usamos `formats: json` con prompt + schema, Firecrawl re-extrae con LLM y resiste cambios moderados de markup.
- **JS render**: `waitFor: 4000` y, si hace falta, subir a 6000. Si en pruebas la página requiere interacción (escribir el número y click), pasar a `actions: [{ type: 'wait', milliseconds: 2000 }, { type: 'write', text: contenedor, selector: '#consnumber' }, { type: 'click', selector: 'button[type=submit]' }, { type: 'wait', milliseconds: 4000 }]` antes del extract.
