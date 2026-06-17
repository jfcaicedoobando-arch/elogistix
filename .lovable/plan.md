# Plan — Facturapi (K: Listo para facturar) + DataTable row selection (desbloquea F)

## Alcance de esta entrega

1. **DataTable row selection** — habilita selección multi-fila reusable en todo el proyecto.
2. **Bloque K — Paso "Listo para facturar"** con Facturapi como proveedor de timbrado CFDI 4.0.
3. **Bloque F — Acciones masivas en Facturas emitidas** sobre la nueva selección: descargar ZIP de PDFs, reenviar por email, marcar "enviada al cliente".

L (consolidar Tab 1+2) y M (extraer CxP) quedan para una siguiente entrega.

---

## 1. DataTable row selection

`src/components/shared/DataTable.tsx` (141 líneas) hoy no expone selección. Cambios:

- Nueva prop opcional `selection?: { selectedIds: Set<string>; onSelectionChange: (ids: Set<string>) => void; }`.
- Cuando se pasa, antepone columna `__select` con checkbox por fila + checkbox "seleccionar todo" en header (sólo de la página actual).
- Helper hook `useRowSelection<T>()` para state controlado por la pantalla consumidora.
- Tests unitarios mínimos: toggle, select-all, clear.

Sin breaking changes: la prop es opcional.

## 2. Bloque K — Listo para facturar con Facturapi

### 2.1 Esquema

Migración:

- Nuevo valor de enum `estado_factura`: `'Por timbrar'` (entre `Borrador` y `Emitida`).
- Columnas en `facturas`:
  - `facturapi_id text` — ID del invoice en Facturapi.
  - `serie text` — letra/código de serie (A, B, …) usado al timbrar.
  - `timbrado_en timestamptz`, `timbrado_por uuid`.
  - `cancelacion_motivo text`, `cancelado_en timestamptz`.
- Columnas en `clientes` (si faltan): `codigo_postal text`, `regimen_fiscal text`, `uso_cfdi_default text`.

### 2.2 Secreto

`FACTURAPI_KEY` (Server Secret Key de Facturapi — live o test). Se solicita con `add_secret` tras aprobar el plan.

### 2.3 Edge Functions

- `facturapi-emitir` — POST `/v2/invoices` con auth Basic. Valida RFC, uso CFDI, código postal del receptor, items con clave SAT. Persiste: `uuid_fiscal`, `folio_fiscal`, `facturapi_id`, `factura_pdf_url`, `factura_xml_url`, `estado = 'Emitida'`, `timbrado_en`, `timbrado_por`. Bitácora.
- `facturapi-cancelar` — DELETE `/v2/invoices/{id}` con motivo SAT (01–04). Actualiza `estado = 'Cancelada'`, `cancelacion_motivo`, `cancelado_en`.
- `facturapi-descargar` — GET PDF/XML por proxy (usa `factura_pdf_url` ya guardada).

Todas con `verify_jwt` por defecto + auth interno (org + rol Admin/Contador).

### 2.4 UI

- Nuevo botón **"Marcar listo para timbrar"** en proformas aprobadas → cambia estado a `Por timbrar`.
- Nuevo sub-tab/sección **"Listo para facturar"** dentro del tab "1. Por aprobar" (o tab 2 reutilizado).
- `DialogTimbrarFactura` — checklist visual:
  - ✅ RFC válido del cliente (regex 13 chars + dígito verificador, lookup en `clientes`).
  - ✅ CSF cargada (badge si existe `clientes.constancia_url`).
  - ✅ Régimen fiscal del receptor.
  - ✅ Código postal del receptor.
  - ✅ Uso CFDI (select con catálogo SAT).
  - ✅ Forma de pago + método de pago (catálogos SAT).
  - ✅ Serie y siguiente folio (de `factura_series`).
  - Botón **"Timbrar ahora"** dispara `facturapi-emitir`. Muestra el UUID, links a PDF/XML.
- Botón **"Cancelar CFDI"** en Facturas emitidas (sólo Admin) → `DialogCancelarFactura` con motivo SAT.

### 2.5 Hooks y servicios

- `src/features/facturas/services/facturapi.ts` — wrapper de las edge functions.
- `useTimbrarFactura()`, `useCancelarFactura()` con invalidación de queries.

## 3. Bloque F — Acciones masivas (encima de la nueva selección)

`TabFacturasEmitidas` recibe `useRowSelection`. Toolbar arriba de la tabla con:

- **Descargar ZIP** — `jszip` (ya disponible o se agrega) bundlea PDFs descargados de Facturapi.
- **Reenviar por email** — invoca `send-transactional-email` por factura (nuevo template `factura-reenvio`).
- **Marcar enviada al cliente** — flag `enviada_cliente_at` en `facturas` (mini-migración).

Tres botones se deshabilitan si `selectedIds.size === 0`.

## Detalles técnicos

- Facturapi API base: `https://www.facturapi.io/v2`. Auth: `Authorization: Basic ${btoa(FACTURAPI_KEY + ':')}`. Endpoints clave: `POST /invoices`, `DELETE /invoices/:id`, `GET /invoices/:id/pdf`, `GET /invoices/:id/xml`.
- El item enviado a Facturapi necesita `product.product_key` (clave SAT) — se toma de `conceptos_factura.clave_sat` (ya existente o se agrega columna en migración separada si falta).
- Si Facturapi devuelve error, se conserva `estado = 'Por timbrar'` y se persiste el mensaje en `bitacora_actividad`.
- Reuso de `factura_series` para folio incremental — la edge function hace `UPDATE … RETURNING` para evitar duplicados.

## Entregables / archivos clave

**Nuevos**

- `supabase/functions/facturapi-emitir/index.ts` + `helpers.ts` + `helpers_test.ts`
- `supabase/functions/facturapi-cancelar/index.ts`
- `src/features/facturas/services/facturapi.ts`
- `src/features/facturacion/hooks/useTimbrarFactura.ts`
- `src/features/facturacion/components/DialogTimbrarFactura.tsx`
- `src/features/facturacion/components/DialogCancelarFactura.tsx`
- `src/features/facturacion/components/FacturasMasivasToolbar.tsx`
- `src/components/shared/dataTable/useRowSelection.ts`
- `supabase/functions/_shared/transactional-email-templates/factura-reenvio.tsx`

**Modificados**

- Migraciones (estado_factura enum + columnas)
- `src/components/shared/DataTable.tsx` (+ subcomponentes)
- `src/features/facturacion/components/TabFacturasEmitidas.tsx`
- `src/features/facturacion/components/TabProformasPendientes.tsx` (botón "Listo para timbrar")
- `src/pages/facturacion/Facturacion.tsx` (sub-tab / sección)
- `CHANGELOG.md`, `src/constants/appVersion.ts` → **13.51.0**

## Pendiente de confirmar antes de implementar

1. **¿Modo Facturapi inicial?** Sandbox (live test key `sk_test_...`) para validar sin timbrar real, o ya producción. SANDBOX
2. **¿Cancelación CFDI?** Incluir flujo de cancelación SAT con motivo en esta entrega, o sólo emisión. Incluir NC y cancelacion. 
3. **¿Email de reenvío masivo?** Confirmar que el envío use el correo del contacto del cliente (`contactos_cliente`) o solicitar destinatarios al disparar. Ambos