
# Item #2 — Envío del CFDI por email al cliente

Aprovechamos FacturApi (`POST /invoices/{id}/email` y `POST /receipts/{id}/email`) que ya envía el PDF + XML adjuntos al cliente. No usamos la cola de emails interna (Mailgun/pgmq) porque FacturApi ya entrega el CFDI con su plantilla SAT-compliant y archivos correctos.

## Alcance

1. **Envío al timbrar (opcional)**: checkbox "Enviar CFDI al cliente por email" en `DialogTimbrarFactura`. Activo por default si el cliente tiene email.
2. **Reenvío manual de factura**: botón "Reenviar CFDI" en `FacturaDetalle` (sólo si está timbrada). Permite editar el destinatario antes de enviar.
3. **Reenvío manual de REP**: botón equivalente en `PagoFacturaRow` cuando el REP está timbrado.
4. **Auditoría**: cada envío se registra en `bitacora_actividad` con destinatario, tipo (factura/REP) y resultado.

## Diseño técnico

### Backend
- **Nueva edge function `facturapi-enviar-email`** (`verify_jwt=true`, CORS strict, `wrapEdgeHandler`):
  - Input: `{ factura_id?, pago_id?, email? }` (uno de los dos IDs).
  - Resuelve org → API key vía `resolveFacturapiKey` (patrón ya existente).
  - Si `email` viene vacío, lo toma del cliente (`clientes.email_facturacion` o `clientes.email`).
  - Llama `POST https://www.facturapi.io/v2/invoices/{facturapi_id}/email` o `/receipts/{id}/email` con `{ "email": [destinatario] }`.
  - Inserta en `bitacora_actividad` (`accion='cfdi_enviado'`, payload con tipo y destinatario).
  - Devuelve `{ ok, enviado_a }` o error normalizado.

### Frontend
- **Servicio** `src/features/facturacion/services/enviarCfdiEmail.ts` con `enviarCfdiFactura(facturaId, email?)` y `enviarCfdiRep(pagoId, email?)`.
- **`DialogTimbrarFactura`**:
  - Agregar `Checkbox` "Enviar CFDI al cliente" + input email (auto-poblado del cliente, editable).
  - Tras `timbrar.mutate` exitoso, si el check está activo, invocar `enviarCfdiFactura`.
  - Mostrar toast independiente del envío (no bloquea el timbrado).
- **Nuevo componente `DialogEnviarCfdi.tsx`** (reutilizado para factura y REP):
  - Campos: destinatario(s) email (multi-email separado por coma, validación), nota opcional ignorada (FacturApi no la acepta vía email endpoint).
  - Botón "Enviar".
- **`FacturaDetalle.tsx`**: nuevo botón "Reenviar CFDI" junto a los botones de descarga (sólo si `uuid_fiscal`).
- **`PagoFacturaRow.tsx`**: botón "Reenviar REP" cuando `rep_uuid` existe.

### Catálogo de errores
- Si FacturApi responde `400 invalid_email`: traducir a "Email inválido".
- Si responde `404`: "CFDI no encontrado en FacturApi" (probablemente cancelado).
- Otros: mensaje genérico + log a Sentry.

## Archivos a crear
- `supabase/functions/facturapi-enviar-email/index.ts`
- `src/features/facturacion/services/enviarCfdiEmail.ts`
- `src/features/facturacion/components/DialogEnviarCfdi.tsx`

## Archivos a editar
- `src/features/facturacion/components/DialogTimbrarFactura.tsx` (checkbox + envío post-timbrado)
- `src/features/facturacion/routes/FacturaDetalle.tsx` (botón reenviar)
- `src/features/facturacion/components/PagoFacturaRow.tsx` (botón reenviar REP)
- `supabase/config.toml` (registrar nueva función)
- `src/constants/appVersion.ts` + `CHANGELOG.md` (bump a `13.137.5`)

## Tests
- Unit del servicio `enviarCfdiEmail` con mock de `supabase.functions.invoke`.
- Deno test del endpoint cubriendo: sin auth, sin IDs, email inválido, happy path factura, happy path REP.

## Out of scope (para iteraciones siguientes)
- Plantillas custom de email (FacturApi maneja el template).
- Envío masivo desde la tabla de facturas (se puede agregar luego en `FacturasMasivasToolbar`).
- Tracking de aperturas/clicks (no expuesto por FacturApi).
