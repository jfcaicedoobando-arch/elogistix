## Tracking externo para navieras no soportadas por JSONCargo

Cuando la naviera del embarque no está soportada por JSONCargo (caso WHLC / Wan Hai, y otras como ANL, HEUNG-A, SITC, etc.), hoy solo mostramos un mensaje informativo sin acción posible. Vamos a ofrecer un link al sitio de tracking oficial de la naviera para que el usuario consulte manualmente con el contenedor o el BL.

### Cambios

1. **Nuevo catálogo `src/lib/jsoncargo/externalTracking.ts`**
   - Mapa de naviera (string libre normalizado) → `{ label, url(container, bl) }` que devuelve la URL de tracking pública.
   - Cubrir como mínimo:
     - `WHLC` / `WANHAI` → `https://www.wanhai.com/...`
     - `ANL` → CMA CGM tracking
     - `SITC` → `https://www.sitcline.com/...`
     - `HEUNG-A` / `HEUNGA` → `https://ekmtc.com/...` o sitio oficial
     - `PAN OCEAN`, `SINOKOR`, `TS LINES`, `KMTC`
   - Función `getExternalTracking(naviera, contenedor, blMaster)` que:
     - Normaliza el nombre (lowercase, sin separadores).
     - Si encuentra match, devuelve `{ label, url }` priorizando contenedor sobre BL.
     - Si no hay match pero existe contenedor, ofrece fallback genérico a track-trace.com (`https://www.track-trace.com/container`).
     - Devuelve `null` si no hay nada útil que enlazar.

2. **`src/components/embarque/TrackingLiveCard.tsx`**
   - Cuando `noSoportada` es `true`, además del mensaje actual, renderizar un botón/link `Abrir tracking en {Naviera}` que abre la URL externa en nueva pestaña (`target="_blank" rel="noopener noreferrer"`).
   - Si solo hay fallback genérico, etiquetarlo como `Buscar en Track-Trace`.
   - Mantener el mensaje actual de "naviera no soportada" pero suavizar el tono ("JSONCargo no soporta esta naviera; consulta el tracking en el sitio del transportista").
   - No tocar el flujo cuando sí está soportada.

3. **Versionado y changelog**
   - Bump a `8.132.2` (patch).
   - Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`: "Tracking externo para navieras no soportadas por JSONCargo (WHLC/Wan Hai y otras)".
   - Actualizar `src/pages/dashboard/Changelog.tsx` si aplica al patrón actual.

### Archivos

Crear:
- `src/lib/jsoncargo/externalTracking.ts`

Modificar:
- `src/components/embarque/TrackingLiveCard.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

### Notas

- No requiere cambios en backend ni en el edge function.
- No se modifica `mapNavieraToJsonCargo`: WHLC sigue devolviendo `null` (correcto).
- El link externo es solo informativo; no se sincroniza nada en la BD desde ahí.
