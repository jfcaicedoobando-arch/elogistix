# Plan: Migrar emisión FacturApi al SDK oficial

## Objetivo
Reemplazar las llamadas `fetch` manuales en las 4 edge functions de FacturApi por el SDK oficial [`facturapi`](https://github.com/FacturAPI/facturapi-node) (Node) cargado en Deno vía `npm:facturapi@5`. Reduce bugs de payload (CFDI 4.0, REP, cancelación), centraliza el manejo de errores tipados y nos deja preparados para auto-provisioning futuro.

## Alcance
Sólo las 4 funciones de emisión/cancelación. El webhook (Fase 4) se queda igual porque sólo verifica firmas y no llama a la API. El multi-tenant resolver (`_shared/facturapiAuth.ts`) y la UI de configuración no cambian.

## Cambios

### 1. Helper compartido — `supabase/functions/_shared/facturapiClient.ts` (nuevo)
- Función `getFacturapiClient(orgId)`:
  1. Llama a `resolveFacturapiKey(orgId)` (ya existe).
  2. `const Facturapi = (await import("npm:facturapi@5")).default;`
  3. Retorna `new Facturapi(apiKey)`.
- Cachea el cliente por `apiKey` con un `Map` simple para evitar re-instanciar en invocaciones frías encadenadas.
- Exporta tipo `FacturapiClient` para que las functions tengan tipado.

### 2. `facturapi-emitir/index.ts`
- Reemplazar el `fetch('https://www.facturapi.io/v2/invoices', { ... })` por:
  ```ts
  const facturapi = await getFacturapiClient(orgId);
  const invoice = await facturapi.invoices.create(payload);
  ```
- Mantener exactamente el mismo `payload` que ya construimos (customer, items, payment_form, use, etc.) — el SDK acepta el mismo shape JSON que la REST API.
- Capturar `FacturapiError` y mapear a respuesta `{ error, details }` con status 400/500 según corresponda.
- Persistir `invoice.id`, `invoice.uuid`, `invoice.folio_number`, `invoice.series` en `public.facturas` como hoy.

### 3. `facturapi-cancelar/index.ts`
- `await facturapi.invoices.cancel(facturapiId, { motive, substitution })`.
- Mismo tratamiento de errores.

### 4. `facturapi-emitir-rep/index.ts`
- `await facturapi.invoices.create(repPayload)` con `type: 'P'` (Pago).
- Conservar la construcción de `complements` y `related_documents` que ya hacemos.

### 5. `facturapi-cancelar-rep/index.ts`
- Idéntico a `facturapi-cancelar` pero apuntando al ID del REP.

### 6. Guardrail arquitectónico
- Extender el test existente `facturapi-multi-tenant.test.ts` (o crear `facturapi-uses-sdk.test.ts`) que falle si alguna de las 4 functions contiene la cadena `https://www.facturapi.io/` o `fetch(` apuntando a FacturApi. Sólo `_shared/facturapiClient.ts` puede importar `npm:facturapi`.

### 7. Tests unitarios
- `supabase/functions/_shared/facturapiClient_test.ts`: mockea `resolveFacturapiKey` y verifica que retorna una instancia y la cachea.
- Smoke test de payload: una pequeña función pura `buildInvoicePayload(input)` extraída de `facturapi-emitir` para poder testear sin red. (Refactor mínimo para tenibilidad.)

### 8. Versionado y changelog
- Bump a `13.136.4`.
- Entrada en `CHANGELOG.md`:
  > **Migración a SDK oficial de FacturApi** — Las 4 edge functions de emisión/cancelación ahora usan `facturapi-node` v5 vía `npm:` specifier en lugar de `fetch` manual. Mejor manejo de errores tipados y menos riesgo de errores de payload en CFDI 4.0 y REP.

## Riesgos y mitigaciones
- **Cold start**: cargar `npm:facturapi@5` puede agregar ~200-400ms la primera vez. Mitigación: cache de cliente y dejar el helper en `_shared` para que Deno lo reuse en la misma instancia.
- **Diferencias de shape**: el SDK acepta el mismo JSON de la REST API pero algunos campos opcionales tienen defaults distintos. Mitigación: comparar respuesta del primer smoke test en sandbox contra la actual antes de marcar la fase como cerrada.
- **Lockfile**: si `deno.lock` se vuelve incompatible (ver `<edge-function-deploy-errors>`), eliminarlo y redeployar.

## Detalles técnicos
- Import: `import Facturapi from "npm:facturapi@5";` (default export del SDK).
- El SDK respeta `process.env.NODE_ENV` para nada relevante aquí; el modo sandbox/live ya lo decide la API key elegida por `resolveFacturapiKey`.
- No agregar `import_map.json`; el `npm:` specifier resuelve solo.
- `verify_jwt` ya está configurado en cada función — no tocar `supabase/config.toml`.

## Fuera de alcance
- Auto-provisioning de organizaciones (UI nueva) — fase futura.
- Eventos adicionales en el webhook — fase futura.
- Cambios en la UI de `/configuracion/facturacion`.

## Validación final
1. `deploy_edge_functions` de las 4 functions.
2. Smoke test en sandbox: emitir una factura de prueba desde la UI y verificar `invoice.id` en `public.facturas`.
3. Correr el guardrail nuevo + tests unitarios.
4. Verificar logs de edge function por errores de cold start o lockfile.
