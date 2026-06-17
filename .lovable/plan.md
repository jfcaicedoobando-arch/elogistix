# Plan: Tests automatizados para toda la Fase 1

Objetivo: blindar con tests cada uno de los 6 items completados en la Fase 1 del plan de auditoría (`.lovable/plan.md`) para que ninguna regresión arquitectónica futura pueda reintroducir los problemas que se acaban de resolver. Todo se hace con Vitest (frontend/arquitectura) y `supabase--test_edge_functions` (Deno tests para edge functions).

---

## 1. Item #1 — Fusión `facturacion` + `facturas`

**Test nuevo:** `src/__tests__/architecture/facturacion-fusion.test.ts`

- Falla si vuelve a existir el directorio `src/features/facturas/`.
- Falla si algún archivo del proyecto importa `@/features/facturas/...` (regex sobre `src/**/*.ts(x)`).
- Verifica que `src/features/facturacion/queryKeys.ts` exporta `facturas` **y** `facturacion`.
- Verifica que `src/lib/query/index.ts` importa `facturas` desde `@/features/facturacion/queryKeys`.

## 2. Item #2 — Romper ciclo `admin ↔ configuracion`

**Test nuevo:** `src/__tests__/architecture/admin-configuracion-cycle.test.ts`

- Escanea `src/features/configuracion/**/*.ts(x)` y falla si encuentra `from "@/features/admin/...`.
- Verifica que `TabExportar.tsx` vive en `src/features/admin/components/` y NO en `src/features/configuracion/components/`.
- Verifica que `src/pages/admin-org/Configuracion.tsx` importa `TabExportar` desde la ruta nueva.

## 3. Item #3 — Eliminar `features/misc`

**Test nuevo:** `src/__tests__/architecture/no-misc-feature.test.ts`

- Falla si existe `src/features/misc/`.
- Falla si algún archivo importa de `@/features/misc/...`.
- Verifica que la API pública sigue intacta: importa `queryKeys` desde `@/lib/query` y comprueba que `queryKeys.bitacora`, `queryKeys.trackingLinks`, `queryKeys.trackingPublico`, `queryKeys.clienteFinancials` y `queryKeys.pdfPreviewCotizacion` están definidos y son arrays/funciones.

## 4. Item #4 — Encapsular `Unsubscribe.tsx`

**Tests nuevos:**

- `src/services/__tests__/unsubscribeService.test.ts` — mockea `supabase.functions.invoke` y cubre:
  - `validateUnsubscribeToken` resuelve con datos cuando la edge function responde OK.
  - Propaga error cuando `invoke` devuelve `error`.
  - `confirmUnsubscribe` envía el payload correcto.
- `src/__tests__/architecture/unsubscribe-encapsulation.test.ts` — falla si `src/pages/auth/Unsubscribe.tsx`:
  - Contiene `fetch(`
  - Contiene `VITE_SUPABASE_URL` o `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY`.

## 5. Item #5 — Centralizar 21 casts en servicios

**Test nuevo:** `src/__tests__/architecture/safe-casts-services.test.ts`

- Reusa el clasificador existente (`scripts/lib/casts.ts`).
- Falla si aparece algún cast `HIGH` o `CRITICAL` en `src/features/**/services/**/*.ts` sin el marcador `// SAFE-CAST:` en las 2 líneas previas.
- Aserción dura: `expect(highOrCritical).toBe(0)` para mantener el umbral actual.

## 6. Item #6 — Edge functions fiscales

Ya creados `helpers_test.ts` (facturapi-emitir, facturapi-cancelar) y `aiHelpers_test.ts` (parse-cfdi-xml) en el sprint anterior. Esta fase añade:

- **Smoke deno test nuevo** `supabase/functions/facturapi-cancelar/index_test.ts` que sólo importa `./helpers.ts` y `./index.ts` no se rompe a la carga (compile-time guard).
- **Smoke deno test nuevo** `supabase/functions/parse-cfdi-xml/index_test.ts` análogo importando `./aiHelpers.ts` + `./parser.ts`.
- Ejecutar la suite Deno completa de las 3 funciones con `supabase--test_edge_functions` y dejar evidencia en el changelog.

## Técnico

- Los tests de arquitectura usan `fs.readFileSync` + `globby`/`fast-glob` ya disponible vía `scripts/lib/walk.ts` (no añadimos dependencias).
- El test de SAFE-CAST reusa `scanCasts()` y `WEIGHT` de `scripts/lib/casts.ts`; ya hay un test similar en `src/__tests__/audit-casts-classifier.test.ts`.
- El mock de `supabase.functions.invoke` se hace al estilo de tests existentes en `src/features/facturacion/hooks/__tests__/*` (vi-mock del módulo `@/integrations/supabase/client`).
- Bump `APP_VERSION` a `13.59.1` y entrada en `CHANGELOG.md`.

## Entregables

```text
src/__tests__/architecture/
  ├── facturacion-fusion.test.ts          (nuevo)
  ├── admin-configuracion-cycle.test.ts   (nuevo)
  ├── no-misc-feature.test.ts             (nuevo)
  ├── unsubscribe-encapsulation.test.ts   (nuevo)
  └── safe-casts-services.test.ts         (nuevo)
src/services/__tests__/
  └── unsubscribeService.test.ts          (nuevo)
supabase/functions/facturapi-cancelar/
  └── index_test.ts                       (nuevo, smoke)
supabase/functions/parse-cfdi-xml/
  └── index_test.ts                       (nuevo, smoke)
CHANGELOG.md + src/constants/appVersion.ts  (bump 13.59.1)
```

## No incluido (fuera de alcance)

- Tests E2E de UI para Unsubscribe (ya cubierto por mocks unitarios).
- Tests de las 17 edge functions restantes (es Fase 3 item #20 del plan, no Fase 1).
- Refactor de los tests existentes en `__tests__/audit-casts-classifier.test.ts` (sólo añadimos uno nuevo más estricto).
