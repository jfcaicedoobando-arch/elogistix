# Actualizar Sentry a 11.x

Objetivo: pasar `@sentry/react` de 10.75.3 a 11.1.0 sin perder reportes de errores, feedback, métricas fiscales ni el filtrado de datos personales. Sin publicar, sin cambiar versión ni CHANGELOG.

## Pasos

1. **Leer la guía oficial de migración 10 → 11** y hacer una lista de los cambios que sí tocan esta app. Si algo requiere rediseño (no solo renombrar), me detengo y te aviso antes de seguir.
2. **Instalar** `@sentry/react@11.1.0`. Revisar si `@sentry/vite-plugin` 5.4.0 y la versión usada en funciones del backend (`supabase/functions/_shared/sentry.ts`) son compatibles; solo se tocan si la guía lo exige.
3. **Ajustar el código afectado**, principalmente:
   - `src/lib/observability/sentry/core.ts` (arranque): integraciones de rastreo de rutas, perfilado, replay, feedback, httpClient, extraErrorData. La app usa React Router 7 y hoy registra la integración "V6"; si 11.x ofrece la de V7 o la retira, se cambia.
   - Uso de `Sentry.metrics` (proformas, embarques, tipos de cambio), `showReportDialog`/`getFeedback` (ErrorBoundary, botón de feedback), `startSpan`, `withScope`, `getCurrentScope`, `setUser`, tipo `ErrorEvent` en filtros (`dropPredicate`, `dropFiltersNegocio`, `helpers`).
   - Mocks de pruebas solo si cambió el nombre de una función (sin alterar su comportamiento).
4. **Validar localmente (focalizado)**: typecheck, lint, pruebas de `src/lib/observability`, ErrorBoundary, auth (sentry), proformas/embarques/tipos de cambio (sentry) y las guardas de arquitectura de Sentry. Revisar que el tamaño del paquete siga ≤365 KB gz.
5. CI y RLS completos quedan para GitHub Actions.

## Riesgos

- Si 11.x elimina algo que usamos (p. ej. el diálogo de reporte o métricas), se reemplaza por el equivalente oficial más pequeño; no se agregan funciones nuevas.
- Si la actualización resulta demasiado invasiva, se revierte a 10.75.3 y te explico por qué.
