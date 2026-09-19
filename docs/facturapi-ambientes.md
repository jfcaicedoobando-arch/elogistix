# FacturAPI: ambientes, webhooks y credenciales (P2 · SDK 5.0)

Guía operativa de cómo el ERP separa **Sandbox (pruebas)** y **Live
(producción)**, qué se verifica en cada ambiente y cómo migrar la configuración
heredada.

## 1. Qué hay por ambiente

Todo vive en `public.facturapi_credenciales`, una fila por organización:

| Dato | Sandbox | Live |
| --- | --- | --- |
| API key (Vault o secret) | `api_key_sandbox_vault_id` / `api_key_sandbox_secret_name` | `api_key_live_vault_id` / `api_key_live_secret_name` |
| Clave de firma del webhook | `webhook_secret_sandbox` | `webhook_secret_live` |
| Webhook remoto (id / URL / eventos) | `webhook_id_sandbox`, `webhook_url_sandbox`, `webhook_eventos_sandbox` | `webhook_id_live`, `webhook_url_live`, `webhook_eventos_live` |
| Última verificación | `webhook_estado_sandbox`, `webhook_verificado_sandbox_at` | `webhook_estado_live`, `webhook_verificado_live_at` |

`ambiente` indica el ambiente ACTIVO de la organización (el que se usa para
timbrar).

`webhook_secret` (sin sufijo) es **legado**: sólo se usa si no existe ninguna
clave por ambiente, y cuando eso ocurre el webhook emite la alerta
`facturapi_webhook_secret_legacy` en Sentry. Migración: guardar la clave del
ambiente correspondiente y dejar el campo legado en `NULL`.

## 2. Verificación de firma del webhook

`facturapi-webhook` prueba el HMAC contra, en este orden:

1. la clave del ambiente activo,
2. la clave del ambiente opuesto (una organización en transición
   sandbox → live sigue recibiendo eventos del ambiente viejo),
3. la clave legada, **sólo** si no hay ninguna por ambiente.

Nunca se asume una clave indistinta. Si ninguna valida, el evento se rechaza con
`401 invalid_signature`.

## 3. Verificación remota (opt-in, administrativa)

Edge function `facturapi-verificar-webhook` (POST, requiere rol emisor fiscal):

```json
{ "organization_id": "<uuid>", "ambiente": "sandbox" | "live" }
```

Compara contra FacturAPI, para ESE ambiente:

- la **dirección** registrada vs. la esperada
  (`<SUPABASE_URL>/functions/v1/facturapi-webhook?org=<uuid>`),
- los **eventos suscritos** vs. los requeridos por el ERP (facturas y REP:
  `status_updated`, `cancellation_status_updated`, `canceled`,
  `delivered_to_customer`),
- el **estado** del webhook (activo / inactivo).

Resultados posibles: `ok`, `no_configurado`, `no_encontrado`, `url_distinta`,
`eventos_faltantes`, `inactivo`, `error`. El resultado se guarda en las columnas
del ambiente verificado y se muestra en Configuración → Facturación electrónica.

La respuesta **nunca** incluye la API key ni la clave de firma; sólo dirección,
id, eventos y estado. Si el ambiente pedido no es el activo de la organización
responde `409 ambiente_no_activo` (fail-closed: no se comparan ambientes
distintos).

## 4. Rate limiting (HTTP 429) y errores

`_shared/facturapiErrorNormalizado.ts` conserva `Retry-After`, `logId`, el
request id y el status de cada error. Ante un 429 el ERP:

- libera el candado del intento (FacturAPI rechazó **antes** de timbrar),
- responde `429` con `Retry-After`, `retry_after_segundos` y
  `reintento_automatico: false`,
- deja los metadatos en bitácora (`facturapi_*_rate_limited`),
- **no** marca el pago/factura como error ni reintenta solo: reintentar a ciegas
  es la vía directa a un CFDI o REP duplicado.

## 5. Adaptador del SDK v5

`_shared/facturapiSdk.ts` centraliza la superficie tipada del SDK
(`invoices.create|retrieve|list|cancel|paymentSummary`, `webhooks.list|retrieve`).
El paquete `facturapi@5.0.0` **sí** publica typings, pero están declarados para
resolución de bundler/Node y el typecheck de Deno no los alcanza desde el
especificador `npm:`; por eso el cliente se modela opaco en
`_shared/facturapiClient.ts` y se tipa aquí, con validación en runtime
(`FacturapiSdkContratoError` si falta una operación).

## 6. Fallback legado `FACTURAPI_KEY` (deprecado)

Existe sólo para la única organización que usaba FacturApi antes del modelo
multi-tenant. Requiere **tres** secrets y ya no asume ambiente:

- `LEGACY_FACTURAPI_ORG_ID` — la organización exacta (ninguna otra lo usa),
- `LEGACY_FACTURAPI_AMBIENTE` — `sandbox` o `live`, **obligatorio**; sin él la
  resolución es fail-closed (412),
- `FACTURAPI_KEY` — la key.

**Migración:** dar de alta la fila en `facturapi_credenciales` con su key en el
Vault, verificar el webhook del ambiente y borrar los tres secrets.

## 7. Qué se prueba en cada ambiente

- **Sandbox:** el flujo completo sin efectos fiscales — timbrado de factura PPD
  con conceptos mixtos (ObjetoImp 02 y 01), pago, REP, cancelaciones y eventos de
  webhook. Guion end-to-end: `docs/facturapi-sandbox-e2e.md`.
- **Live:** sólo verificación de configuración (conexión, dirección y eventos del
  webhook, certificado y datos fiscales). Nunca se emiten comprobantes de prueba
  en producción.
