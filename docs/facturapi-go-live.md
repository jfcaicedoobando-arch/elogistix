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

## Versión del SDK en uso
`supabase/functions/_shared/facturapiClient.ts` importa `npm:facturapi@5.1.0`
(publicada el 18-sep-2026, última confirmada en el GitHub oficial). Los breaking
changes de v5 son de tipado (`SearchResult<T>` con totales opcionales, retiro de
`CursorSearchResult<T>`) más un fix de serialización de query params anidados;
no afectan nuestros payloads. Hay un guard de versión en
`src/__tests__/architecture/facturapi-multi-tenant.test.ts`.

## Capacidades del PAC disponibles (aún no implementadas en Libre Carga)
Revisión del GitHub de FacturApi el 2026-08-29:
- **Complemento de Leyendas Fiscales** (documentado en facturapi-docs).
- **Rescue CFDI**: recuperación de CFDI emitidos fuera de FacturApi.
- **Borradores de retenciones** (SDK 4.19.0): no emitimos retenciones hoy.
- **`invoices.paymentSummary`** (SDK 4.21.0): devuelve el documento relacionado
  del complemento de pago (parcialidad, saldo anterior e impuestos prorrateados
  al monto pagado). No lo usamos: hoy calculamos el prorrateo nosotros.
- **Status 202** (timbrado asíncrono): hoy timbramos en síncrono; si el PAC
  empieza a responder 202 habrá que ajustar los flujos de timbrado.

## Errores comunes
| Código | Causa | Acción |
|---|---|---|
| `412 org_facturapi_not_configured` | Falta fila en `facturapi_credenciales` o falta nombre de secret para el ambiente activo | Completar la tarjeta en Configuración |
| `500 missing_facturapi_key` | El secret referenciado no existe en Lovable Cloud | Crear el secret con el nombre exacto |
| `412 webhook_not_configured` | El webhook llegó pero falta `webhook_secret` para la org | Guardar el secret que dio FacturApi |
| `401 invalid_signature` | El secret del webhook no coincide con el que firma FacturApi | Re-copiar el secret desde el dashboard |

## No objeto de impuesto (SAT ObjetoImp 01) y complemento de pago
Investigación del 2026-09-18 (P1 · auditoría IVA):
- La guía de llenado del SAT indica que un concepto con `ObjetoImp = 01` **no
  debe** declarar nodo de impuestos. Por eso el ERP bloquea "no objeto" con
  retenciones de ISR/IVA en la UI y en `facturapi-emitir` /
  `facturapi-emitir-nota-credito` (`_shared/noObjetoFiscal.ts`).
- El REP 2.0 declara `ObjetoImpDR` por documento relacionado y con `01` no debe
  existir el nodo `ImpuestosDR` (Anexo 29 RMF 2026): **el SAT sí lo permite**.
  Revalidado el 2026-09-18 contra la documentación pública de Facturapi
  (`/docs/guides/invoices/pago`, `/api`): `related_documents[]` expone `uuid`,
  `amount`, `installment`, `last_balance` y `taxes` — **no expone
  `ObjetoImpDR`**. Por lo tanto es una **limitación actual de la integración**,
  no una prohibición fiscal, y así debe comunicarse al usuario.
- Decisión: no se emite PPD con conceptos no objeto. El diálogo de timbrado lo
  impide antes de emitir y el servidor lo rechaza (fail-closed). Nunca se
  convierte a Exento ni a Tasa 0%. El proceso alterno (emitir PUE o corregir el
  tratamiento) lo define Contabilidad.
- `related_documents[].taxes` sí es un arreglo prorrateado por pago, por lo que
  una PPD con varios tratamientos (16% + 0% / Exento / 8%) **sí** se cobra: cada
  grupo lleva su propia BaseDR prorrateada (`trasladoDr.ts` +
  `buildTaxesDr`), sin tasas promedio.

## REP con renglones «No objeto de impuesto» (SAT 01) — vía estructurada

El SDK 5.1.0 expone `PaymentRelatedDocument.taxability`, que es el
`ObjetoImpDR` del documento relacionado. El REP viaja **siempre** estructurado
(`complements[].type = "pago"`); la ruta de XML manual (`pagoXml.ts`,
`pagoXmlDr.ts`, `repManual.ts`) se retiró el 2026-09-21 porque el sandbox la
rechazaba con `400 El campo complements no es válido`.

- `helpers.ts · buildRepPayload` — asigna `taxability` desde `objeto_imp_dr`
  (fallback seguro `"02"`).
- `taxesDr.ts · buildTaxesDr` — única fuente de la regla de impuestos: `[]`
  cuando `taxability = "01"`; la usa también el cotejo con `paymentSummary`.

Reglas fiscales aplicadas:

- `ObjetoImpDR="01"` sólo cuando **todos** los renglones del documento son no
  objeto; en ese caso se omite `ImpuestosDR` (el SAT prohíbe declarar un
  impuesto inexistente, aunque sea en ceros).
- Factura mixta ⇒ `ObjetoImpDR="02"` declarando **únicamente** los impuestos de
  los renglones gravados. El importe no objeto entra al denominador del
  prorrateo, no al cálculo del impuesto.
- Nunca se reclasifica un renglón a `Exento` ni a tasa 0%.

Responsabilidad y verificación: al armar el XML nosotros asumimos su validez
(versión, orden de nodos, decimales). Antes de usarlo en producción, emitir un
REP en el ambiente de pruebas del proveedor y revisar el XML timbrado con
Contabilidad. Si el proveedor rechaza el complemento, el pago queda en estado
`Error` con `rep_error` (`MSG_REP_NO_OBJETO` o el error del proveedor), sin
timbrar ni duplicar, y es reintentable.
