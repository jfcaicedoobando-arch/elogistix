# Plan: Retirar integración JSONCargo

Basado en `docs/deprecation-jsoncargo.md`. Se elimina todo el código activo del proveedor. La tabla `tracking_externo` **se conserva** (servirá de caché para el reemplazo). El Tab Tracking del embarque queda solo con eventos manuales / hitos del wizard.

## 1. Edge Functions (Supabase)

- Eliminar carpeta `supabase/functions/jsoncargo-track/` (incluye `index.ts` y `validate_test.ts`).
- Eliminar `supabase/functions/_shared/jsoncargoSync.ts` y `supabase/functions/_shared/jsoncargo.ts`.
- Llamar `supabase--delete_edge_functions` con `["jsoncargo-track"]` para retirar el deploy.
- Revisar `supabase/config.toml` por si hay bloque específico de `jsoncargo-track` (actualmente no parece haberlo).

## 2. Frontend — Hooks y servicios

Eliminar (no hay otros consumidores fuera de la familia JSONCargo):

- `src/hooks/embarque/useJsonCargoTracking.ts`
- `src/hooks/embarque/useJsonCargoBolLookup.ts`
- `src/hooks/embarque/useTrackingLiveCard.ts`
- `src/hooks/embarque/useDialogBolContainers.ts`
- `src/hooks/embarque/mutations/useActualizarContenedorEmbarque.ts` (su única función es disparar sync JSONCargo)
- `src/services/embarque/jsoncargo.ts`
- `src/services/embarque/jsoncargoFechas.ts`
- `src/services/embarque/__tests__/jsoncargoFechas.test.ts`
- Toda la carpeta `src/lib/jsoncargo/` (helpers, navieras, prefixes, summary, externalTracking, tests).

Actualizar barrels:
- `src/hooks/embarque/index.ts`: quitar exports de `useJsonCargoBolLookup`, `useJsonCargoTracking`, `useTrackingLiveCard`.
- `src/services/embarque/index.ts`: quitar `export * from "./jsoncargo"`.
- `src/lib/query/keys/misc.ts`: quitar el namespace `jsonCargo` (`byEmbarque`).

## 3. Frontend — UI

- Eliminar componentes:
  - `src/components/embarque/TrackingLiveCard.tsx`
  - `src/components/embarque/trackingLive/TrackingWarnings.tsx`
  - `src/components/embarque/trackingLive/TrackingSummaryGrid.tsx`
  - `src/components/embarque/trackingLive/TrackingFechasPropuestas.tsx`
  - `src/components/embarque/DialogBolContainers.tsx`
- `src/components/embarque/TabTracking.tsx`: quitar import y render de `<TrackingLiveCard>`. Si tras la limpieza la prop de naviera/contenedor queda sin uso, simplificar la interfaz del componente y su llamada en `EmbarqueDetalle`. El tab queda solo con eventos manuales / timeline.
- `src/pages/portal/PortalEmbarqueDetalle.tsx`: quitar import y render de `<TrackingLiveCard>` (mismo comportamiento que el detalle interno).

## 4. Mutaciones de embarque

- `src/hooks/embarque/mutations/useUpdateEmbarque.ts` (~línea 44): eliminar el bloque que invoca `jsoncargo-track` tras actualizar embarque marítimo.
- `src/hooks/embarque/mutations/useCreateEmbarque.ts`: verificar y limpiar cualquier invocación residual (búsqueda confirma que no hay, pero re-validar).
- Eliminar referencias al hook `useActualizarContenedorEmbarque` si existen consumidores; reemplazar por update directo del contenedor sin trigger de sync.

## 5. Documentación

- Marcar `docs/integrations/jsoncargo-api.md` como histórico (mover a `docs/archive/` o anteponer banner "DEPRECATED — proveedor retirado en vX.Y.Z").
- Actualizar `docs/deprecation-jsoncargo.md` con la fecha de remoción y nota "Ejecutado".
- Limpiar menciones en `docs/rc-qa-checklist.md`, `docs/release-notes-12.0.md`, `docs/audit-cleanslate-11.69.0.md`, `docs/pagination-audit.md` (solo notas; no romper estructura).

## 6. Base de datos

- **No tocar** la tabla `tracking_externo` (se conserva como caché para el próximo proveedor según el doc de deprecación).
- No se requiere migración SQL.

## 7. Secretos

- Tras el merge, pedir al usuario eliminar `JSONCARGO_API_KEY` (y similares) en Lovable Cloud → Edge Function secrets. No se borra desde código.

## 8. Changelog y versión

- `CHANGELOG.md`: nueva entrada `## [12.31.0] - 2026-06-01` con bullet "Removida integración JSONCargo (edge function, hooks, UI, libs y tests). La tabla `tracking_externo` se conserva como caché para el futuro proveedor de tracking."
- `src/constants/appVersion.ts`: bump a `12.31.0` (cambio mayor de feature → minor bump).

## 9. Validación

- `rg "jsoncargo|JSONCargo|JSONCARGO|JsonCargo" src/ supabase/functions/` debe devolver vacío (solo permanecen menciones históricas en `docs/`).
- Build/typecheck automáticos del harness deben pasar.
- Smoke manual: abrir un embarque marítimo y el portal cliente equivalente; confirmar que el Tab Tracking renderiza sin el card de "Tracking en vivo" y sin errores en consola.

## Notas técnicas

- Se elimina ~35 archivos (hooks/services/lib/components/tests/edge functions).
- Cancela la tarea original "tracking multi-contenedor" de Fase 2 (`mem://audit/pendings`), reemplazada por esta remoción + futura integración del nuevo proveedor.
- Riesgo bajo: el código a remover está autocontenido bajo el namespace `jsoncargo`, sin acoplamientos cruzados fuera de los puntos enumerados en §3 y §4.