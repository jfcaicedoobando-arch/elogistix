# Plan — Auditoría Sentry → versión `13.114.19`

Dos sub-agentes revisaron el SDK frontend y las 21 edge functions. La instrumentación base está sólida (ErrorBoundary en 3 niveles, `wrapEdgeHandler`, scrub PII, tunnel con rate-limit, 0 funciones sin Sentry, 0 mismatches en tests guardrail). Hay **8 huecos reales** que cerrar — todos de bajo riesgo, sin cambios de semántica.

## Hallazgos a corregir

| # | Sev | Archivo | Problema | Fix |
|---|---|---|---|---|
| 1 | 🔴 ALTA | `supabase/functions/auditoria-weekly-digest/index.ts` (~L126) | `processOrg()` serializa el error y devuelve 200 al cron → fallo por org invisible en Sentry | `captureEdgeException(rpcErr, { fn, extra:{ organization_id }})` antes del `return { error }` |
| 2 | 🟠 MEDIA | `src/main.tsx` (L82-83) | `initSentry()` en `requestIdleCallback` → ventana ciega ~1.5 s; crashes tempranos del primer render no llegan | Inicializar Sentry **antes** de `createRoot()` (mantener el lazy import dinámico, sólo eliminar el `requestIdleCallback`) |
| 3 | 🟠 MEDIA | `src/lib/observability/sentry/core.ts` | `beforeSend` sólo scrubea `ErrorEvent`; las transactions con PII en URL no se filtran | Añadir `beforeSendTransaction` reutilizando `scrubEventPii` |
| 4 | 🟠 MEDIA | `supabase/functions/client-error-log/index.ts` | Handler sin try/catch externo: errores en `createClient` o rate-limit escapan | Envolver el body del handler en try/catch con `captureEdgeException` (más simple que migrar a `wrapEdgeHandler`) |
| 5 | 🟠 MEDIA | `src/features/cotizacion/services/candadoCostos.ts` (L19) | `console.error` en catch sin reporte a Sentry | Usar `reportCaughtError` / `logger.error` con tag `feature: 'cotizacion'` |
| 6 | 🟠 MEDIA | `src/lib/observability/piiScrub.ts` | Falta regex de tarjetas bancarias (PAN) | Añadir `CARD_RE` con validación Luhn para evitar falsos positivos en folios largos |
| 7 | 🟡 BAJA | `src/lib/observability/sentry/helpers.ts` `sampleByRoute` | `/inicio` (dashboard real) cae al 10% default; `/dev/*` (preview PDF interno) consume cuota; portal detalle merece 100% | `/inicio` → 0.05, `/dev/` → 0, `/portal/(embarques\|cotizaciones\|facturas)/:id` → 1.0 |
| 8 | 🟡 BAJA | `supabase/functions/user-management/index.ts` y `auditoria-explicar-hallazgo/index.ts` | Sólo capturan cuando `status >= 500`; 4xx inesperados son invisibles | Capturar también en `status >= 400` (o sin condición de status en el catch raíz) |

## No incluido (justificación)

- **CORS `*` en `sentry-tunnel`**: restringir rompería previews de Lovable (`*.lovable.app` cambian de subdominio). Ya hay rate-limit + whitelist de hosts destino. Se queda como está.
- **Migrar a `createBrowserRouter`** para nombres de ruta parametrizados: cambio invasivo, no es un gap de cobertura sino de calidad de señal.
- **`captureConsoleIntegration`**: aumentaría ruido y cuota; el `logger` y los `reportCaughtError` ya cubren los caminos importantes.
- **Migrar `parse-csf` / `auditoria-explicar-hallazgo` de `serve()` legacy a `Deno.serve(wrapEdgeHandler)`**: cambio de estructura mayor, ya tienen catch manual.

## Versionado

- `src/constants/appVersion.ts` → `13.114.19`
- `CHANGELOG.md` → entrada `## [13.114.19] - 2026-06-23` con bullets por hallazgo

## Validación

- `vitest run` sobre `src/lib/observability/**` y `src/__tests__/architecture/sentry-*`
- Añadir test unitario para `beforeSendTransaction` (scrub PII en URL de transaction) y para el reporte de `processOrg` en `weekly-digest`
- `deno test` en `auditoria-weekly-digest` (si tiene `digest_test.ts`)

## Archivos a tocar (10)

1. `supabase/functions/auditoria-weekly-digest/index.ts`
2. `supabase/functions/client-error-log/index.ts`
3. `supabase/functions/user-management/index.ts`
4. `supabase/functions/auditoria-explicar-hallazgo/index.ts`
5. `src/main.tsx`
6. `src/lib/observability/sentry/core.ts`
7. `src/lib/observability/sentry/helpers.ts`
8. `src/lib/observability/piiScrub.ts`
9. `src/features/cotizacion/services/candadoCostos.ts`
10. `src/constants/appVersion.ts` + `CHANGELOG.md`

¿Apruebas para implementar?
