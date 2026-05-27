
## Objetivo

Hacer que **todas** las llamadas a `notifyError` aprovechen el reporte estructurado introducido en `12.0.0-rc.7` (requestId, errorCode, validationErrors de Zod, method). Hoy solo el wizard de cotización lo hace; los otros ~115 call sites solo pasan `title` + `description` (string), por lo que el extractor no puede derivar `errorCode` ni `validationErrors`.

## Alcance

120 call sites de `notifyError` distribuidos en `src/hooks/**`, `src/components/**`, `src/pages/**` y `src/lib/**`.

## Cambios por call site

Para cada `notifyError(toast, { ... })` dentro de un `catch (err) { ... }`:

1. Añadir `error: err` (objeto crudo — habilita extracción Zod / Postgrest / `errorCode`).
2. Añadir `method: "<VERBO_SEMÁNTICO>"` (ej. `DELETE_COTIZACION`, `UPDATE_PROVEEDOR`, `CONVERT_PROSPECT`, `IMPORT_LEADS_CSV`). Convención: `VERBO_RECURSO` en MAYÚSCULAS_SNAKE.
3. Mantener `title` y `description` actuales (UX no cambia).

Para `notifyError` que **no** vienen de un `catch` (validaciones inline tipo "Agrega al menos un concepto"):
- Añadir solo `errorCode: ERROR_CODES.VALIDATION_FAILED` y `method: "<VALIDATE_...>"`. No hay `error` raw que pasar.

## Agrupación de archivos (por módulo)

Se editarán en lotes paralelos por módulo para mantener PRs lógicos:

- **Cotización** (8 archivos): `wizard/*` ya hecho; faltan `useCotizacionDetalleHandlers`, `useCotizacionesPageController`, `usePortalCotizacionDetalleController`, mutations.
- **Embarque** (13 archivos): `useProformas`, `useDialogBolContainers`, `useEmbarqueSubmitOrchestrator`, `useEmbarqueDocumentosActions`, `useEmbarquesPageController`, `useDescargarProformaPdf`, `useNuevoEmbarqueWizard`, `useEditarEmbarqueWizard`, `useEmbarqueForm`, `useEmbarqueEstadoActions`, `useEmbarqueDetalleTracking`, `useTrackingLiveCard`, dialogs.
- **Cliente / Proveedor** (5 archivos).
- **CRM** (10 archivos): leads, oportunidades, actividades, plantillas, etapas, motivos.
- **Catálogos** (3 archivos): puertos, navieras, tipos de contenedor.
- **Facturación / Admin / Configuración / Portal / Usuarios / Auth** (~10 archivos).
- **Lib** (`trackingLiveHelpers.ts`).

## Verificación

- `bunx vitest run src/lib/ui/__tests__/errorDetailsExtract.test.ts` debe seguir verde.
- `rg "notifyError\(" src -t ts -A6 | rg -B1 "error:" | wc -l` cerca del total de catches.
- Spot-check: provocar un error en CRM y revisar payload JSON con `requestId` + `errorCode`.

## Versionado

- Bump `APP_VERSION` → `12.0.0-rc.8`.
- Entrada en `CHANGELOG.md`:
  > Reporte de errores estructurado aplicado globalmente: todas las notificaciones de error ahora incluyen `requestId`, `errorCode` y `method`, y extraen `validationErrors` de errores Zod.

## Fuera de alcance

- No se cambia UI ni textos de toasts.
- No se tocan `notifySuccess` / `notifyWarning`.
- No se refactoriza `appFeedback.ts` ni `errorReport.ts` (ya soportan los nuevos campos).
