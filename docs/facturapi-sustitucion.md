# Sustitución CFDI — flujo asíncrono (v13.301.0+)

## Contexto

La cancelación de un CFDI en el SAT NO siempre es inmediata. Por regla
2.7.1.34 RMF, si el CFDI supera $1,000 MXN y NO se cancela el mismo día de
emisión, el receptor tiene **72 horas hábiles** para aceptar o rechazar la
cancelación desde su Buzón Tributario (silencio positivo). FacturApi expone
este estado en el campo `cancellation_status`:

| Valor       | Significado                                                  |
| ----------- | ------------------------------------------------------------ |
| `none`      | No hay solicitud registrada.                                 |
| `verifying` | El SAT recibió la solicitud y la está validando.             |
| `pending`   | Requiere aceptación del receptor.                            |
| `accepted`  | Cancelación aceptada (terminal).                             |
| `rejected`  | El receptor rechazó (terminal).                              |
| `expired`   | El receptor no respondió en 72 h — silencio positivo (terminal). |

## Estado en BD (`public.facturas`)

- `cancellation_status text` — refleja el valor devuelto por FacturApi.
- `cancelacion_solicitada_en timestamptz` — cuándo se envió la solicitud.
- `cancelacion_vence_en timestamptz` — vencimiento estimado (72 h hábiles).
- `estado` (enum) — sólo pasa a `Cancelada`/`Sustituida` cuando el SAT
  confirma `accepted`. Mientras el status sea `pending`/`verifying` la
  factura sigue en `Timbrada`/`Emitida`.
- `sustituida_por uuid` — se llena desde la solicitud (no depende de la
  aceptación final).

## Componentes del flujo

### 1. Edge `facturapi-cancelar`

Llama `facturapi.invoices.cancel()` y ramifica según `cancellation_status`:

- `accepted` (o `status='canceled'` sin ack): flujo histórico — descarga
  acuse XML, marca estado terminal, revierte proformas ligadas si no fue
  sustitución.
- `pending` / `verifying`: guarda `cancellation_status`,
  `cancelacion_solicitada_en`, `cancelacion_vence_en` (via RPC
  `calc_cancelacion_vence`), sin cambiar `estado` ni tocar proformas.
- `rejected` / `expired`: guarda el status y regresa 409 con mensaje.

### 2. Edge `facturapi-webhook`

FacturApi emite `invoice.cancellation_status_updated` cuando el receptor
acepta/rechaza o cuando el SAT resuelve. El webhook sincroniza sólo el
campo `cancellation_status`. El cambio a `Cancelada`/`Sustituida` + acuse
+ reversión de proformas lo hace el cron (necesita descargar acuse y
correr lógica de negocio, no cabe en la firma del webhook).

### 3. Cron `facturapi-reconciliar-cancelaciones`

Cada 30 minutos consulta a FacturApi el estado real de todas las facturas
con `cancellation_status IN ('pending','verifying')`. Si detecta:

- `accepted` → descarga acuse, marca estado terminal, revierte proformas
  (si no es sustitución), bitácora `facturapi_cancelada_async` /
  `facturapi_sustituida_async`.
- `rejected` / `expired` → limpia solicitud (`cancelacion_solicitada_en` y
  `cancelacion_vence_en = NULL`), bitácora `facturapi_cancelacion_no_aceptada`.
- Sin cambio → no-op.

Programado con `pg_cron` (job `facturapi-reconciliar-cancelaciones`,
schedule `*/30 * * * *`).

### 4. UI `DialogSustituirFactura`

Flujo single-tab:

1. **Intro**: usuario confirma → llama RPC `duplicar_factura_para_sustitucion`
   (copia conceptos, seals a NULL, estado `Borrador`) → guarda
   `sustitucion:{facturaId}` en sessionStorage con `nuevaId` y `ts` →
   navega a `/facturacion/{nuevaId}?accion=timbrar` en la misma pestaña.
2. **Timbrado del borrador**: usuario edita/timbra el CFDI sustituto
   normalmente. FacturApi asigna `related_documents` automáticamente al
   detectar `sustituye_a`.
3. **Volver a la original**: al reabrir el diálogo de sustitución, se
   detecta el `sessionStorage` y se restaura el paso "confirmar", con
   botones "Volver al borrador" y "Cancelar original". La cancelación
   dispara la edge `facturapi-cancelar` con `motivo='01'` y
   `sustituida_por_factura_id=nuevaId`.

El entry de sessionStorage expira automáticamente a las 24 h.

## Diagrama

```text
┌──────────┐    duplicar    ┌──────────┐    timbrar    ┌──────────┐
│ Original │ ─────────────► │ Borrador │ ────────────► │ Sustituta│
│ Timbrada │                │  → BOR   │               │ Timbrada │
└─────┬────┘                └──────────┘               └────┬─────┘
      │                                                     │
      │  cancelar (motivo 01, substitution=facturapi_id)    │
      │◄────────────────────────────────────────────────────┘
      │
      ▼ FacturApi devuelve cancellation_status
  ┌─────────┴─────────┐
  │                   │
accepted           pending/verifying
  │                   │
  ▼                   ▼
Estado: Sustituida    Estado: Timbrada (sin cambio)
Acuse guardado        cancelacion_solicitada_en / _vence_en
                      │
                      ▼ cron cada 30 min
                  Reconciliar → accepted/rejected/expired
```

## Errores comunes

- `CancelacionSAT no está disponible` → error transitorio del SAT.
  `facturapi-cancelar` devuelve `transient: true` y la UI ofrece
  reintentar sin cerrar el modal.
- `No cancelable por SAT` → típicamente falta aceptación del receptor
  (regla 2.7.1.34) o hay REP/NC vinculados. El mensaje enriquecido lo
  explica.

## Pruebas E2E

Spec: `e2e/specs/25-sustituir-cfdi.spec.ts` (sandbox).

```bash
E2E_FISCAL=1 \
E2E_SUSTITUCION_FACTURA_UUID=<uuid-factura-timbrada-sandbox> \
npx playwright test 25
```

Corre en el project `chromium-mutators` (serial). Cubre: happy path,
persistencia sessionStorage, guard UI y auto-reset ante borrador eliminado.
