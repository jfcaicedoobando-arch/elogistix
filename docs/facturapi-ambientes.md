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
clave por ambiente **y** la ventana de compatibilidad
`FACTURAPI_WEBHOOK_LEGACY_HASTA` (fecha ISO) sigue vigente. Sin esa variable, o
ya expirada, el legado no valida nada. Cuando se usa, el webhook emite la alerta
`facturapi_webhook_secret_legacy` en Sentry. Migración: guardar la clave del
ambiente correspondiente, dejar el campo legado en `NULL` y borrar la variable.

## 2. Verificación de firma del webhook (aislamiento estricto)

`facturapi-webhook` acepta **una sola** clave: la del ambiente resuelto para ese
evento. Nunca prueba la del ambiente opuesto.

El ambiente se resuelve así:

1. si la URL trae `&amb=sandbox` o `&amb=live`, ése es el ambiente;
2. si no, el ambiente **activo** de la credencial;
3. un `&amb` con cualquier otro valor se rechaza con `400 ambiente_invalido`.

Consecuencias, intencionales: una firma de Sandbox **no** valida en una
organización configurada en Live (y viceversa), y si el ambiente resuelto no
tiene clave propia el evento se rechaza (`412 webhook_not_configured`) aunque el
otro ambiente sí la tenga. Si la firma no coincide: `401 invalid_signature`.

### Transición Sandbox ↔ Live

La única transición soportada es **URL aislada por ambiente**: se registra en
FacturAPI, para cada ambiente, su propia dirección con `&amb=`:

```
<SUPABASE_URL>/functions/v1/facturapi-webhook?org=<uuid>&amb=sandbox
<SUPABASE_URL>/functions/v1/facturapi-webhook?org=<uuid>&amb=live
```

Así los dos ambientes pueden convivir sin que uno valide eventos del otro. La
compatibilidad con la clave legada es temporal, explícita y auditable: exige
`FACTURAPI_WEBHOOK_LEGACY_HASTA` con fecha futura y queda registrada en Sentry.

## 3. Verificación remota (opt-in, administrativa)

Edge function `facturapi-verificar-webhook` (POST, requiere rol emisor fiscal):

```json
{ "organization_id": "<uuid>", "ambiente": "sandbox" | "live" }
```

Compara contra FacturAPI, para ESE ambiente, usando la API key de ESE ambiente
(la activa, o la del otro ambiente resuelta explícitamente; nunca se mezclan ni
se inventan claves). Si la organización no tiene clave de API para el ambiente
pedido responde `409 ambiente_sin_credencial`.

- la **dirección** registrada vs. las esperadas (la simple
  `?org=<uuid>` y la aislada `?org=<uuid>&amb=<ambiente>`; ambas se aceptan),
- los **eventos suscritos** vs. los requeridos por el ERP (facturas y REP:
  `status_updated`, `cancellation_status_updated`, `canceled`,
  `delivered_to_customer`),
- el **estado** del webhook (activo / inactivo).

Resultados posibles: `ok`, `no_configurado`, `no_encontrado`, `url_distinta`,
`eventos_faltantes`, `inactivo`, `error`. El resultado se guarda en las columnas
del ambiente verificado y se muestra en Configuración → Facturación electrónica.

La respuesta **nunca** incluye la API key ni la clave de firma; sólo dirección,
id, eventos y estado. El indicador `secretLegado` sólo es `true` cuando de hecho
la firma se validaría con la clave legada (no hay ninguna por ambiente).


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

## 6. Fallback legado `FACTURAPI_KEY` — retirado (2026-09-21)

El fallback que permitía a una organización sin fila en
`facturapi_credenciales` usar el secret global `FACTURAPI_KEY` (con
`LEGACY_FACTURAPI_ORG_ID` y `LEGACY_FACTURAPI_AMBIENTE`) **fue eliminado**.

**Razón:** verificación en la base productiva — todos los CFDI emitidos con
FacturAPI pertenecen a una sola organización y ésta ya tiene su fila completa
(`ambiente=live`, sandbox y live configuradas, `facturapi_org_id` presente).
Ninguna organización con CFDI quedaba dependiendo del fallback, y mantener una
key global es riesgo de mezclar cuentas y folios entre tenants.

**Conducta actual (fail-closed):** sin fila en `facturapi_credenciales`,
`resolveFacturapiKey` responde `412 org_facturapi_not_configured` de inmediato.
Las únicas keys que se leen del entorno son los secrets **nombrados por
organización** declarados en esa tabla (o el Vault). Aunque existan
`FACTURAPI_KEY` o `LEGACY_FACTURAPI_*` en el entorno, el resolver los ignora;
hay pruebas Deno y un guardrail arquitectónico que impiden reintroducirlos.

## 7. Qué se prueba en cada ambiente

- **Sandbox:** el flujo completo sin efectos fiscales — timbrado de factura PPD
  con conceptos mixtos (ObjetoImp 02 y 01), pago, REP, cancelaciones y eventos de
  webhook. Guion end-to-end: `docs/facturapi-sandbox-e2e.md`.
- **Live:** sólo verificación de configuración (conexión, dirección y eventos del
  webhook, certificado y datos fiscales). Nunca se emiten comprobantes de prueba
  en producción.
