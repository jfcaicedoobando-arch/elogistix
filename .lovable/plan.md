## Mapear OOCL/OOLU → COSCO en JSONCargo

JSONCargo no soporta OOCL como naviera independiente; sus contenedores (prefixes OOLU/OOCU/OOCL) se consultan bajo `COSCO` (OOCL es subsidiaria 100% de COSCO). Hoy `mapNavieraToJsonCargo("OOLU")` devuelve `null`, por eso el embarque ELIMP00194 ve la card como "naviera no soportada" y no aparecen los botones Sincronizar ni Buscar por BL Master.

### Cambios

1. `src/lib/jsoncargo/navieras.ts` — extender `mapNavieraToJsonCargo` para reconocer también:
   - `oocl`, `oolu`, `oocu`, `orientoverseas` → `COSCO`
   - Mantener el resto del mapeo intacto.

2. `supabase/functions/_shared/jsoncargo.ts` — espejo del mapeo en backend (`NAVIERA_MAP`):
   - Agregar `oocl: "COSCO"`, `oolu: "COSCO"`, `oocu: "COSCO"`, `orientoverseas: "COSCO"`.

3. Versionado y changelog: bump a `8.132.1` (patch) con entrada en `chunks/0.ts` y `changelogData.ts` explicando que OOCL/OOLU se rutea por COSCO.

### Notas

- No se toca el catálogo de prefixes (OOLU/OOCU ya estaban mapeados a COSCO).
- No requiere migración de datos; los embarques con naviera "OOLU"/"OOCL" empezarán a funcionar automáticamente.
- Verificación post-cambio: en ELIMP00194 deben aparecer ambos botones y el lookup por BL `OOLU2324325340` con `shipping_line=COSCO` debe responder.

### Archivos

Modificar:
- `src/lib/jsoncargo/navieras.ts`
- `supabase/functions/_shared/jsoncargo.ts`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`