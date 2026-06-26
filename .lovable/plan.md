## Bloque alta prioridad — pasos 3 y 4

Ya cerramos #1 (PDF/XML vía proxy) y #2 (email). Siguen los dos puntos fiscales más sensibles del bloque:

### Paso 3 — Notas de crédito (CFDI tipo E)

**Objetivo**: emitir una nota de crédito ligada a una factura existente (devolución, descuento o bonificación), timbrarla en FacturApi y reflejarla en saldos.

**Backend**
- Tabla nueva `public.facturas_notas_credito` (ya existe `factura_notas_credito` — revisaremos columnas y la reutilizamos o ampliamos):
  - `id`, `organization_id`, `factura_id` (FK), `numero`, `serie`, `folio`, `motivo` ('01' devolución, '02' descuento, '03' bonificación), `monto`, `moneda`, `tipo_cambio`, `facturapi_id`, `uuid_fiscal`, `pdf_url`, `xml_url`, `estado` (`borrador`/`timbrada`/`cancelada`), `creado_por`, timestamps.
  - GRANT a `authenticated`/`service_role`, RLS por `organization_id` con `has_role`.
- Nueva edge function `facturapi-emitir-nota-credito` (`verify_jwt=true`, `wrapEdgeHandler`, CORS strict):
  - Input: `{ nota_credito_id }`.
  - Carga la NC + factura original; arma payload SDK con `type: "E"`, `related: [uuid_factura]`, `relationship: "01"` (Nota de crédito), conceptos con la misma clave SAT.
  - Llama `facturapi.invoices.create()` vía `getFacturapiClient`.
  - Actualiza la NC con uuid/folio/urls, registra `bitacora_actividad` (`nc_timbrada`).
- Nueva edge function `facturapi-cancelar-nota-credito` (mismo patrón que `facturapi-cancelar`).
- RPC `recalcular_saldo_factura(factura_id)` que descuenta NCs timbradas no canceladas para que el saldo pendiente refleje la nota.

**Frontend**
- Servicio `src/features/facturacion/services/notasCreditoFacturapi.ts` con `crearNotaCredito`, `timbrarNotaCredito`, `cancelarNotaCredito`.
- Componente `DialogCrearNotaCredito.tsx` usando `FormDialogShell`:
  - Selección de motivo SAT, monto (validado ≤ saldo de la factura), moneda heredada, conceptos editables (precargados desde la factura).
  - Botón "Guardar y timbrar" (crea + invoca edge function).
- Sección "Notas de crédito" dentro de `FacturaDetalle.tsx` (lista con estado, monto, acciones: ver PDF/XML, reenviar email, cancelar).
- Reutiliza `FacturaDownloadButton` (ya soporta proxy) y `DialogEnviarCfdi` para envío.

### Paso 4 — Cancelación con sustitución (motivo 01)

Hoy `DialogCancelarFactura` ya permite elegir motivo 01 y capturar el UUID que sustituye, pero el flujo es manual (el usuario debe timbrar antes la factura nueva y pegar su UUID).

**Mejoras**
- Backend: extender `facturapi-cancelar` para aceptar `sustituye_factura_id` (en vez de UUID crudo) y resolver internamente el `uuid_fiscal` de esa factura — evita errores de copia/pega.
- Nuevo flujo "Sustituir factura" en `FacturaDetalle.tsx`:
  - Botón "Cancelar y sustituir" abre wizard 2 pasos (`FormDialogStepper`):
    1. **Crear sustituta**: duplica la factura actual (RPC `duplicar_factura_para_sustitucion(factura_id)`), permite editar y timbrar.
    2. **Cancelar original**: una vez timbrada la sustituta, invoca cancelación motivo 01 con `sustituye_factura_id` de la nueva.
- RPC `duplicar_factura_para_sustitucion`:
  - Inserta nueva factura en estado borrador con los mismos conceptos, cliente y proforma origen.
  - Marca metadato `sustituye_a_factura_id` para trazabilidad.
- Auditoría: ambos eventos (`factura_sustituida`, `factura_cancelada_01`) a `bitacora_actividad` con referencias cruzadas.
- UI: badge "Sustituida por FAC-XXXX" en la factura cancelada y "Sustituye a FAC-YYYY" en la nueva.

### Guardrails CI a actualizar (los dos pasos)

- `sentry-edge-coverage.test.ts` y `sentry-edge-wrapping.test.ts`: agregar `facturapi-emitir-nota-credito`, `facturapi-cancelar-nota-credito`.
- `facturapi-multi-tenant.test.ts`: añadir las 2 nuevas funciones al array `FILES`.
- `supabase/config.toml`: no se requiere bloque (defaults OK).
- Tests Deno por función nueva (happy path + sin auth + payload inválido).
- Tests unit del servicio frontend con mock de `supabase.functions.invoke`.

### Entrega por turnos

Para mantener PRs pequeños y trazables propongo este orden:

1. **Turno A — Notas de crédito (backend)**: migración tabla/RLS/RPC + edge functions + tests Deno. Bump `13.137.7`.
2. **Turno B — Notas de crédito (frontend)**: servicio, dialog, sección en `FacturaDetalle`. Bump `13.137.8`.
3. **Turno C — Sustitución (backend + RPC duplicar)**: extender `facturapi-cancelar`, RPC `duplicar_factura_para_sustitucion`. Bump `13.137.9`.
4. **Turno D — Sustitución (frontend wizard + badges)**. Bump `13.137.10`.

### Fuera de alcance (queda para bloque siguiente)
- Reintento manual de REP, cancelación de REP con UI (items 5–6 — quick wins ya planeados).
- Aplicación automática de NC a saldos en cobranza/conciliación bancaria.
- Webhook sync (item del bloque medio).

¿Arrancamos con el **Turno A (Notas de crédito backend)** o prefieres ajustar el orden (p. ej. hacer sustitución primero)?
