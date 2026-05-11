# Tracking por IA para navieras fuera de JSONCargo

## Objetivo

Cuando un embarque usa una naviera que **no** está soportada por JSONCargo (Wan Hai, TS Lines, Sealand, etc.), permitir que el sistema obtenga ETD / ETA / ubicación / eventos consultando la web pública de la naviera mediante un scraper genérico con adaptadores y extrayendo los datos con Lovable AI (Gemini). El resultado se guarda en la misma tabla `tracking_externo` que ya usa JSONCargo, para que la UI existente (timeline, propuesta de ETD/ETA, badge "estimado") siga funcionando sin cambios estructurales.

Primer adaptador: **Wan Hai Lines**.

## Decisiones tomadas

- Diseño **genérico con adaptadores** por naviera (no solo Wan Hai).
- Identificador: intenta primero **contenedor**, fallback a **BL Master**.
- Scraping: **fetch directo del HTML**; si la respuesta no contiene datos válidos → **Firecrawl** con `waitFor`.
- Disparo: **auto (cron diario) + manual** desde `TrackingLiveCard`, con throttle de 30 min igual que JSONCargo.

## Arquitectura

```
TrackingLiveCard ──► useSyncAiTracking ──► edge fn ai-track ──► resolver(naviera)
                                                                 │
                                                                 ├─► fetch HTML directo
                                                                 │     └─ fallback ─► Firecrawl scrape
                                                                 │
                                                                 └─► Lovable AI (Gemini) extracción JSON
                                                                       │
                                                                       └─► tracking_externo (provider='ai:wanhai')
                                                                            + eventos_embarque
```

## Cambios técnicos

### 1. Base de datos

Migración menor sobre `tracking_externo`:

- Ampliar el dominio de `provider` (actualmente texto libre) — no requiere DDL; solo convención de valores `ai:wanhai`, `ai:tslines`, etc.
- Añadir columna `extraction_confidence numeric(3,2) null` para guardar la confianza reportada por Gemini.
- Añadir columna `source_url text null` con la URL exacta de la página scrapeada.

### 2. Edge functions

**`supabase/functions/_shared/ai-tracking/`** (nuevo módulo compartido):

- `registry.ts` — mapa `naviera → adaptador`. Cada adaptador implementa:
  ```ts
  interface CarrierScraperAdapter {
    code: string;                              // 'wanhai'
    matches(naviera: string): boolean;
    buildLookupUrls(input: { container?: string; bl?: string }): {
      primary: string;                         // container o BL
      fallback?: string;                       // el otro
      method: 'GET' | 'POST';
      formData?: Record<string, string>;       // para JSF
      waitFor?: number;                        // ms para Firecrawl
    };
    extractionPrompt: string;                  // contexto específico de la naviera
  }
  ```
- `wanhai.ts` — primer adaptador. Endpoint conocido: `https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml`. Como es JSF, el método primario es POST con el form + cookies de sesión; si falla, Firecrawl con `formats: ['markdown']` y `waitFor: 3000`.
- `scrape.ts` — helper genérico `scrapeWithFallback()` que intenta fetch nativo y si no encuentra señales (ETA/ETD/vessel keywords) cae a Firecrawl.
- `extract.ts` — llama a Lovable AI Gateway (`google/gemini-3-flash-preview`) con `Output.object` y este schema:
  ```ts
  z.object({
    container_status: z.string().nullable(),
    last_location: z.string().nullable(),
    current_vessel: z.string().nullable(),
    current_voyage: z.string().nullable(),
    atd_origin: z.string().nullable(),         // ISO date
    eta_final_destination: z.string().nullable(),
    shipped_from: z.string().nullable(),
    shipped_to: z.string().nullable(),
    events: z.array(z.object({
      tipo: z.enum(['Zarpe','Transbordo','Arribo a Puerto','Despacho Aduanal']),
      descripcion: z.string(),
      ubicacion: z.string(),
      fecha: z.string(),                       // ISO
    })),
    confidence: z.number().min(0).max(1),
  })
  ```

**`supabase/functions/ai-track/index.ts`** (nuevo, equivalente a `jsoncargo-track`):

- Body: `{ embarqueId }`. Valida JWT, lee el embarque, resuelve adaptador por `naviera`.
- Throttle 30 min vs `tracking_externo.last_synced_at` (mismo patrón que jsoncargo).
- Si no hay adaptador → 200 `{ ok: false, reason: 'unsupported_carrier' }`.
- Ejecuta scrape + extract, persiste `tracking_externo` (`provider='ai:<code>'`, `raw_payload` con `{ html_excerpt, extracted, source_url }`).
- Inserta eventos en `eventos_embarque` (deduplicando por `tipo + fecha`).
- Devuelve `summary` con la misma forma que `JsonCargoSummary` para que el frontend lo reutilice.

**`supabase/functions/ai-track-batch/index.ts`** (nuevo): cron diario, recorre embarques en tránsito cuya naviera mapea a un adaptador y dispara `ai-track` con service role. Se añade entrada en `supabase/config.toml` con `schedule = "0 6 * * *"`.

### 3. Frontend

- **`src/lib/aiTracking/carriers.ts`** — espejo del registry para que la UI sepa si una naviera está soportada por IA (función `isAiTrackingSupported(naviera)`).
- **`src/hooks/embarque/useAiTracking.ts`** — equivalente a `useJsonCargoTracking`, mismo shape de `summary`.
- **`src/components/embarque/TrackingLiveCard.tsx`** — añade una segunda fuente: si JSONCargo no aplica (naviera no soportada) pero IA sí, muestra el bloque AI con un badge "Datos por IA – pueden no estar al día" y la `confidence` como tooltip. Mantiene el flujo de "Aplicar ETD/ETA propuestos" reutilizando `useApplyJsonCargoFechas` (renombrar a `useApplyTrackingFechas`).
- Botón **"Actualizar con IA"** con `Sparkles` icon, deshabilitado si no hay contenedor ni BL.

### 4. Connectores y secrets

- Activar conector **Firecrawl** (`standard_connectors--connect`) para que `FIRECRAWL_API_KEY` esté disponible en las edge functions.
- `LOVABLE_API_KEY` ya existe (lo usa `parse-csf`).
- Sin nuevos secrets manuales.

### 5. Auditoría y costos

- En la card mostrar `last_synced_at`, `source_url` (link externo) y `confidence`.
- Throttle 30 min y cron diario contienen el consumo: Firecrawl ≈ 1 crédito por sync, Lovable AI ≈ 1 llamada Gemini Flash por sync.
- Registro en `bitacora_actividad` con accion `tracking_ai_sync` para trazabilidad.

### 6. Changelog y versión

- `APP_VERSION` → `8.135.0` (feature menor).
- Entradas en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Verificación

1. Embarque con naviera **Wan Hai** y contenedor real → botón "Actualizar con IA" trae ETD/ETA y al menos 1 evento.
2. Embarque con naviera **ZIM** → la UI sigue mostrando JSONCargo (no aparece la fuente IA).
3. Embarque sin contenedor pero con BL → adaptador usa fallback a BL.
4. Sin créditos / error de Firecrawl → toast claro, no rompe la card.
5. Cron diario corre sin errores en `ai-track-batch` con service role.

## Fuera de alcance

- Otros adaptadores aparte de Wan Hai (la arquitectura los soporta, se añaden después en chunks pequeños).
- Reescritura de la UI existente de JSONCargo.
- Mostrar la fuente IA en el portal del cliente (por ahora solo interno).
