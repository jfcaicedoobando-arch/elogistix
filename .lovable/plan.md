
## Contexto

El portal de FacturAPI muestra la factura F971 como **`status: "valid"`** y **`cancellation_status: "none"`** (no está en proceso de cancelación). Sin embargo, al intentar cancelarla desde Libre Carga, FacturAPI devuelve `409 "no cancelable por el SAT"`.

Según la documentación pública de FacturAPI (`GET /v2/invoices/{id}`), cada factura expone estos campos que hoy no consultamos en vivo:

- `status`: `valid` | `canceled` | `pending`
- `cancellation_status`: `none` | `pending` | `accepted` | `rejected` | `expired`
- `canceled_at`, `related_documents[]` (aquí aparecen REP / notas de crédito relacionadas)

El 409 típicamente ocurre cuando el SAT rechaza porque existe **al menos un documento relacionado activo** (Recibo de Pago / Nota de Crédito) o porque la factura sustituta (`F971-R`) sigue viva y el SAT exige aceptación del receptor. FacturAPI **replica** la respuesta del SAT sin bloquear la factura en su portal, por eso ahí sigue "valid".

## Plan

### 1. Nueva Edge Function `facturapi-consultar` (solo lectura)

- `POST /facturapi-consultar` con `{ factura_id }`.
- Valida JWT + `organization_id` como las demás funciones.
- Hace `GET /v2/invoices/{facturapi_id}` a FacturAPI.
- Devuelve al frontend:
  - `status`, `cancellation_status`, `canceled_at`, `uuid`, `folio_number`, `series`
  - `related_documents` resumido (relación + folios)
  - Diferencias detectadas contra la BD local (`estado`, `cancellation_status`, `uuid_fiscal`).
- Si detecta divergencia (ej. remoto = `canceled` pero local = `Emitida`), aplica el mismo `resolveNextAction` que el cron para reconciliar en el momento.

### 2. Botón "Verificar estatus con FacturAPI" en el detalle de factura

- Ubicación: `FacturaDetalle.tsx`, junto a las acciones (Cancelar / Sustituir).
- Muestra el resultado en un `Dialog` con dos columnas: **En FacturAPI** vs **En Libre Carga**, resaltando divergencias.
- Si hubo reconciliación automática, invalida las queries relevantes.

### 3. Enriquecer el mensaje de error 409 en `facturapi-cancelar`

Cuando el `detail.message` contenga "no cancelable" o "facturas relacionadas", incluir en la respuesta la lista de `related_documents` que FacturAPI acaba de devolver, para que la UI diga textualmente:

> "El SAT rechazó la cancelación. FacturAPI reporta N documentos relacionados activos: REP folio 123, Nota de Crédito folio 45. Debes cancelarlos primero."

### 4. Tests

- `reconcile.test.ts`: agregar caso `remote.status = "valid"` + local `Cancelada` → outcome `no_change` (defensa contra divergencias).
- Deno test de `facturapi-consultar` con `fetch` mockeado.
- Vitest para el nuevo botón (spy sobre `supabase.functions.invoke`).

### 5. Changelog

`APP_VERSION` → `13.301.10` + entrada en `CHANGELOG.md`.

## Detalles técnicos

- Endpoint FacturAPI: `GET https://www.facturapi.io/v2/invoices/{invoice_id}` con `Authorization: Basic base64(sk_xxx:)`.
- El cron actual (`facturapi-reconciliar-cancelaciones`) sólo revisa facturas cuyo `cancellation_status` local esté en `pending`/`verifying`; por eso F971 nunca se reconcilia sola. El endpoint nuevo cubre ese hueco bajo demanda.
- Sin cambios de esquema BD.

## Qué NO se toca

- El flujo de sustitución (`DialogSustituirFactura`) sigue igual.
- No se fuerza la cancelación: sólo diagnostica y refleja el estado real que el SAT / FacturAPI reportan.
