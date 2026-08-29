# FacturApi — Guía de Go-Live por organización

Pasos para activar facturación electrónica para una organización en Libre Carga.
Las 4 edge functions (`facturapi-emitir`, `facturapi-cancelar`, `facturapi-emitir-rep`,
`facturapi-cancelar-rep`) más el receptor `facturapi-webhook` ya son multi-tenant
(Fase 2). La UI vive en Configuración → Facturación (Fase 3).

## 1. Crear cuenta en FacturApi
1. Registra la organización en https://www.facturapi.io.
2. Obtén dos API keys: una de **Sandbox** (`sk_test_...`) y, cuando esté lista, una de **Live** (`sk_live_...`).
3. Sube el CSD (Certificado de Sello Digital) firmado por el SAT en FacturApi.

## 2. Guardar las API keys como secrets de Lovable Cloud
Por convención, el nombre del secret es `FACTURAPI_KEY_<ORGID8>_<AMBIENTE>`, donde
`<ORGID8>` son los primeros 8 caracteres del UUID de la organización en mayúsculas
(sin guiones). Ejemplo: `FACTURAPI_KEY_A1B2C3D4_SANDBOX`.

La UI sugiere el nombre exacto en Configuración → Facturación. Crea el secret
desde la pantalla de gestión de secrets con la API key como valor.

## 3. Configurar la organización en la UI
Como `admin_org` o `super_admin`:
1. Ve a **Configuración → Facturación**.
2. En la tarjeta **FacturApi**: selecciona el ambiente (Sandbox para pruebas),
   pega el nombre del secret recién creado y guarda.
3. Marca **datos fiscales completos** y la fecha de vencimiento del CSD.

## 4. Configurar el webhook (opcional pero recomendado)
1. En FacturApi Dashboard → Webhooks, agrega la URL:
   ```
   https://<project>.functions.supabase.co/facturapi-webhook?org=<UUID_ORG>
   ```
2. FacturApi te dará un **webhook secret**: guárdalo en la columna
   `facturapi_credenciales.webhook_secret` para esa org.
3. El receptor valida la firma `facturapi-signature` (HMAC-SHA256 hex) y
   actualiza `facturas.estado`, `uuid_fiscal`, `cancelado_en` y
   `enviada_cliente_at` según el evento.

## 5. Smoke test
1. Crea una factura cualquiera, márcala lista para timbrar.
2. Dispara **Timbrar** desde la UI. Debe responder con UUID y PDF/XML.
3. Verifica en `bitacora_actividad` que existan eventos `facturapi_emitida`.
4. Cancela esa factura con motivo `02` para validar el flujo de cancelación.

## 6. Cutover a producción
1. Crea el secret `FACTURAPI_KEY_<ORGID8>_LIVE` con la API key live.
2. En la tarjeta de configuración cambia el ambiente a **Producción**.
3. Avísale a la organización: a partir de ese momento todo timbrado es real.

## Capacidades del PAC disponibles (aún no implementadas en Libre Carga)
Revisión del GitHub de FacturApi el 2026-08-29:
- **Complemento de Leyendas Fiscales** (documentado en facturapi-docs).
- **Rescue CFDI**: recuperación de CFDI emitidos fuera de FacturApi.
- **Borradores de retenciones** (SDK 4.19.0): no emitimos retenciones hoy.
- **Status 202** (timbrado asíncrono): hoy timbramos en síncrono; si el PAC
  empieza a responder 202 habrá que ajustar los flujos de timbrado.

## Errores comunes
| Código | Causa | Acción |
|---|---|---|
| `412 org_facturapi_not_configured` | Falta fila en `facturapi_credenciales` o falta nombre de secret para el ambiente activo | Completar la tarjeta en Configuración |
| `500 missing_facturapi_key` | El secret referenciado no existe en Lovable Cloud | Crear el secret con el nombre exacto |
| `412 webhook_not_configured` | El webhook llegó pero falta `webhook_secret` para la org | Guardar el secret que dio FacturApi |
| `401 invalid_signature` | El secret del webhook no coincide con el que firma FacturApi | Re-copiar el secret desde el dashboard |
