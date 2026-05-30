## Objetivo

Permitir al cliente abrir una factura desde `/portal/facturas` y ver el desglose completo, descargar PDF/XML, y consultar los pagos registrados.

## Alcance

Solo capa de presentación + 1 query nueva. RLS ya cubre lectura para `cliente` en `facturas` y `pagos_factura` — sin cambios de schema.

## Ruta y navegación

- Nueva ruta: `/portal/facturas/:id` → `PortalFacturaDetalle.tsx` (registrada en `src/routes/portalRoutes.tsx`).
- En `PortalFacturas.tsx`: convertir cada `<Card>` en `<Link to={`/portal/facturas/${f.id}`}>`. Quitar el `hover:shadow-sm` engañoso anterior; ahora la card sí es accionable (cursor pointer, focus ring).
- Breadcrumb: `Inicio › Facturas › {numero}` vía `PORTAL_BREADCRUMB_MAP` dinámico (ya hay patrón en cotización detalle).

## Datos

Extender `src/services/portal/columns.ts`:
- `PORTAL_FACTURA_DETAIL_COLUMNS` = lista actual + `tipo_cambio, referencia_bl, notas, embarque_id, factura_pdf_url, factura_xml_url, snapshot_emision, cliente_id`.

Extender `src/services/portal/queries.ts`:
- `fetchPortalFactura(id)` — `from('facturas').select(PORTAL_FACTURA_DETAIL_COLUMNS).eq('id', id).maybeSingle()`. Retorna `null` si RLS bloquea.
- `fetchPortalPagosFactura(facturaId)` — `from('pagos_factura').select('id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia').eq('factura_id', facturaId).order('fecha_pago', { ascending: false })`.

Extender `src/hooks/portal/usePortalData.ts`:
- `usePortalFactura(id?)` y `usePortalPagosFactura(facturaId?)` siguiendo el patrón existente.
- Agregar keys en `src/lib/query/keys/`: `portal.factura(id)` y `portal.pagosFactura(id)`.

## Componentes UI

Dividir para mantener todos los archivos < 200 líneas (Power of 10):

- `src/pages/portal/PortalFacturaDetalle.tsx` (~120 ln)
  - Header: número factura, badge estado, monto total grande, botón "Volver".
  - Acciones: descargar PDF (si `factura_pdf_url`) y XML (si `factura_xml_url`) usando `usePortalDocumentDownload` (ya existe — verificar que acepta urls externas o adaptar; si las URLs son del bucket privado, usar `supabase.storage.from(...).createSignedUrl()`).
  - Link al embarque relacionado: `/portal/embarques/:embarque_id`.

- `src/components/portal/factura/PortalFacturaResumenCard.tsx` (~80 ln)
  - Grid con: Cliente, Expediente, Fecha emisión, Fecha vencimiento, Moneda, Tipo de cambio, Referencia BL, Notas.
  - Pills de subtotal / IVA / total con formato MXN.

- `src/components/portal/factura/PortalFacturaConceptosTable.tsx` (~80 ln)
  - Lee `snapshot_emision` (jsonb con los conceptos al momento de emitir). Si no existe, muestra empty state "Factura sin desglose disponible".
  - Mobile: cards apiladas. Desktop: tabla simple (concepto, cantidad, precio, importe).

- `src/components/portal/factura/PortalFacturaPagosCard.tsx` (~80 ln)
  - Lista de pagos: fecha, monto + moneda, forma de pago, referencia, monto aplicado.
  - Empty state si no hay pagos: "Aún no se han registrado pagos para esta factura."
  - Pie: "Saldo pendiente: $X" calculado en cliente = `total - sum(monto_aplicado_factura)`.

## Mobile (sigue patrón portal v12.21+)

- `PortalBottomNav` ya cubre la navegación inferior — no se toca.
- Header con monto total sticky-top en `<sm` para que siempre se vea el saldo.
- Botones de descarga full-width en mobile, inline en desktop.

## Cambios menores en lista

- `PortalFacturas.tsx`: card → link, añadir `ChevronRight` mobile, agregar `aria-label="Ver factura {numero}"`.

## Constraints

- Sin cambios de RLS ni schema (políticas existentes ya permiten `cliente` leer facturas y pagos de sus clientes).
- Sin `style={{}}`, tokens semánticos (`bg-accent`, `text-muted-foreground`).
- Reutilizar `formatCurrency`, `formatDate`, `getEstadoColor`, `EmptyState`, `PageHeader`.
- Tests: extender `src/services/portal/__tests__/queries.test.ts` con `fetchPortalFactura` y `fetchPortalPagosFactura` (mock supabase, ordering, propagación de error).

## Versión y changelog

- Bump `APP_VERSION` → `12.23.0`.
- Entrada en `CHANGELOG.md`:
  - Nueva página de detalle de factura en el portal del cliente.
  - Descarga de PDF y XML cuando estén disponibles.
  - Historial de pagos visible con saldo pendiente calculado.

## Fuera de alcance

- Generar PDF on-the-fly si `factura_pdf_url` está vacío (requiere lógica de emisión — decisión de producto).
- Permitir al cliente "reportar pago" desde el portal (requiere mutation + RLS insert para `cliente`).
- Refactor de `TablaConceptosGenerico` (cross-cutting con vista admin).
