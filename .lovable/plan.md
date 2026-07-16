## Contexto

Al cancelar F975 con motivo 01 y sustituta F988, FacturAPI devolvió `400` con el mensaje **"No se especificó el motivo de cancelación o el motivo no es válido"**. La bitácora sólo guarda `{status: 400, message: "..."}` — no vemos el `code` ni `errors[]` que FacturAPI devuelve, así que quedamos sin pistas para saber si el problema es:

- La sustituta F988 no quedó timbrada con `related_documents: [{relationship:"04", documents:[UUID_F975]}]`.
- F975 tiene notas de crédito o REP ligados que la vuelven no cancelable.
- El PAC/SAT rechazó la operación por otra causa.

La causa raíz del "toast poco útil" es un bug de observabilidad: `describeFacturapiError` (`supabase/functions/_shared/facturapiClient.ts`) sólo lee `err.response?.data`, pero el SDK `facturapi@4.18.0` expone los campos **planos** en la instancia del error (`code`, `path`, `location`, `errors`, `logId`). Los tiramos.

## Plan de fix

### 1. Capturar el error completo del SDK (observabilidad)

**Archivo:** `supabase/functions/_shared/facturapiClient.ts`

Actualizar `describeFacturapiError` para devolver además `code`, `path`, `location`, `errors[]`, `logId`. Retornar shape `{ status, detail: { message, code?, path?, location?, errors?, logId? } }`.

### 2. Propagar el detalle al frontend y a bitácora

**Archivo:** `supabase/functions/facturapi-cancelar/index.ts`

- Incluir `code` y `errors[]` en la fila de bitácora `facturapi_cancelar_failed`.
- Enriquecer el `message` humano que vuelve al frontend con el `code` cuando existe (`[SAT CFDI40147] …`).

### 3. Pre-flight cuando motivo=01

**Archivo:** `supabase/functions/facturapi-cancelar/cancelacion.ts`

Antes de llamar `invoices.cancel`:

- Si `motivo === "01"` con `sustituidaPorFacturaId`, hacer `facturapi.invoices.retrieve(sustitutaFacturapiId)` y verificar que `related_documents` contiene un bloque `{ relationship: "04", documents: [<uuid_F975>] }`.
- Si no, responder 422 con un mensaje accionable: “La factura sustituta F988 no referencia a F975 con relación SAT 04. Vuelve a timbrar la sustituta desde el asistente de sustitución.”

Esto convierte el 400 críptico de FacturAPI en un mensaje que el usuario puede accionar solo.

### 4. Enriquecer `enrichCancelacionErrorMessage`

**Archivo:** `supabase/functions/facturapi-cancelar/cancelacion.ts`

Agregar patrones para:

- `motivo/motive.*(no.*(v[aá]lido|especificado))` → guía: “FacturAPI rechazó el motivo. Suele ocurrir cuando la sustituta no fue timbrada con relación 04 al UUID original, o cuando la original tiene notas de crédito/REP ligados. Usa **Consultar en FacturAPI** para comparar.”

### 5. UX: acción “Consultar en FacturAPI” en el modal de cancelación

**Archivo:** `src/features/facturacion/components/DialogCancelarFactura.tsx`

Cuando `cancelar.error` esté presente, mostrar un botón secundario “Consultar en FacturAPI” que abra `DialogConsultarFacturapi` para la factura actual (ya existe el hook). Cierra el modal de cancelación y abre el de consulta.

### 6. Versionado

- `APP_VERSION` → `13.301.25`
- Entrada en `CHANGELOG.md`.

## Detalles técnicos

- La forma real del error del SDK `facturapi@4.18.0` es una clase `FacturapiError` con propiedades planas (verificado en bundle CJS `dist/index.cjs.js`): `{message, status, code, path, location, errors, logId, headers}`. NO existe `err.response.data`.
- El `retrieve` extra sólo se hace cuando motivo=01, así que no impacta la ruta feliz de 02/03/04.
- La verificación de `related_documents` es idempotente y no muta estado.
- Se añade test unitario ligero para `describeFacturapiError` (asegurar que preserva `code` y `errors`).

## Verificación

1. `bun run ci:fast` (lint + typecheck + vitest) verde.
2. Reintentar cancelación de F975 en preview:
   - Si F988 no tiene relación 04 → toast claro sugiriendo re-timbrar la sustituta.
   - Si sí la tiene y el error persiste → bitácora ahora incluirá `code` y `errors[]` para siguiente iteración.
