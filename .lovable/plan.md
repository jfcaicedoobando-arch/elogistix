# Wave 11 · Bug bash live (post-verificación)

Un subagente auditó 16 candidatos. Resultado: **13 vigentes, 1 parcial, 2 ya cerrados** (B-050, B-053). Los dos cerrados se descuentan del pendiente y se anotan en CHANGELOG. Difiero B-027, B-034, B-058 por complejidad M (rediseño de flujo/estado) — irán en Wave 12.

## Alcance de esta ola (8 fixes S/M)

| ID | Archivo | Cambio |
|---|---|---|
| **B-026** | `ActualizarEtaForm.tsx`, `appFeedback.ts/types.ts` | `etaSchema` recibe `etd` y aplica `.refine(eta >= etd)`. Añadir `duration`/`id` a `ErrorNotifyOptions` para que los toasts crudos ya no queden `Infinity`. |
| **B-037** | `DialogRegistrarPagoProveedor.tsx` | Al abrir, invalidar `queryKeys.cxp.factura(id)` y usar hook `useFacturaProveedor(id)` en lugar de la prop cacheada. Evita registrar pago sobre saldo obsoleto. |
| **B-038** | `date-picker-mx.tsx` | En las 3 ramas de `emitIfValid`/`commit` que hoy sólo hacen `setInvalid(true)`, llamar también `onChange("")` para no persistir el valor stale (evita que se guarde "hoy" cuando el parse falla). |
| **B-039** | `useActividadEmbarque.ts` | Dedup: filtrar notas `tipo='cambio_estado'` que caigan dentro de ±2 min de una entrada de bitácora `accion='cambiar_estado'` sobre el mismo embarque. |
| **B-047** | `CxpPorCapturar.tsx` | Desestructurar `isError`/`refetch` del hook y añadir rama `<ErrorStateInline onRetry={refetch} />`; ya no queda "Cargando…" perpetuo si la query falla. |
| **B-048** | `ResumenConceptosVentaTotales.tsx` | Quitar labels `"MXN:"`/`"USD:"` — `formatCurrency` ya antepone el código. Fin del `MXN: MXN 2,320.00`. |
| **B-049** | `HistorialProformas.tsx` | Reemplazar `"Pendiente revisión"` por `"Pendiente cliente"` (label unificado con el resto del módulo). |
| **B-061** | `RegistrarAnticipoDialog.tsx`, `AplicarAnticipoDialog.tsx` | Añadir segundo argumento a `handleSubmit(onValid, onInvalid)` que llama `notifyError` con los mensajes agregados de `FieldErrors` — fin de los submits mudos. |
| **B-035** (parcial) | `types/form.ts`, `formDefaults.ts`, `SeccionMercanciaWrapper.tsx`, `mappers/cotizacion.ts` | Campo dedicado `descripcionMercancia` en el schema del wizard + input en la sección Mercancía; el mapper deja de caer al sector económico. |

## Bugs verificados y descartados (no re-abrir)
- **B-050** — ya cerrado en v13.320.39 (regex de siglas en `text.ts`).
- **B-053** — ya cerrado en v13.320.40 (variante equivalente al diff, no idéntica).

## Diferidos a Wave 12 (complejidad M, rediseño de flujo)
- **B-027** — Guarda de datos mínimos Borrador→Confirmado (nuevo helper + validaciones).
- **B-034** — Captura obligatoria de `fecha_cierre_real`/`valor_real` al ganar oportunidad (UI + mutation).
- **B-058** — Transición "Cancelar embarque" + ocultar Eliminar en Entregado (nuevo estado + UI header).

## Detalles técnicos
- Todos los cambios cliente-side/UI; sólo B-037 toca una query key existente (sin migración).
- Sin migraciones SQL en esta ola.
- Tests: extender `ActualizarEtaForm.test.tsx` (refine ETA≥ETD), `date-picker-mx.test.tsx` (clear on invalid), y snapshot para `ResumenConceptosVentaTotales` (label sin duplicado).
- Bump `APP_VERSION` a `13.320.47` y actualizar `CHANGELOG.md` con nota por bug + descuento de B-050/B-053.

## Sprint status tras Wave 11
- Cerrados esperados: 34 (previo) + 8 nuevos + 2 verificados = **44/63**.
- Pendientes: **19** (incluye B-027, B-034, B-058 diferidos + resto de bajas cosméticas).
