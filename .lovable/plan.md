## Objetivo

Construir una página de **detalle de factura** completa para la app principal (`/facturacion/:id`) que reemplace la dependencia actual de los diálogos modales `DialogHistorialPagos` y `DialogRegistrarPago` para tareas de revisión profunda, y **alinear el portal del cliente** (`/portal/facturas/:id` — ya existe desde 12.23.0) para compartir componentes presentacionales cuando sea seguro y no rompa la separación de capas (app/portal).

## Alcance

- **Nuevo**: página de detalle en app principal con acciones admin (registrar pago, descargar PDF/XML, regenerar, ver embarque, ver proforma origen, ver bitácora).
- **Refinamiento**: portal existente — extraer componentes puramente presentacionales a `src/components/facturacion/shared/` para reuso, sin filtrar lógica admin al portal.
- **Sin cambios**: schema, RLS, lógica de cálculo financiero, lifecycle de estados.

## App principal — `/facturacion/:id`

### Ruta y navegación
- Registrar en `src/routes/appRoutes.tsx`:
  ```
  /facturacion/:id → FacturaDetalle (lazy)
  ```
- En `facturacionColumns.tsx`: la columna `# Factura` (sticky) se convierte en `<Link to={`/facturacion/${f.id}`}>` con `e.stopPropagation()` para no romper los handlers de fila existentes. Se añade botón "Ver" en el menú de acciones por fila.
- Breadcrumb: `Facturación › {numero}` vía `useRegisterBreadcrumbLabel`.

### Datos
Crear `src/services/facturas/queries.ts`:
- `fetchFacturaById(id)` — `from('facturas').select(...).eq('id', id).maybeSingle()` con columnas: las de lista + `tipo_cambio, referencia_bl, notas, embarque_id, proforma_id, factura_pdf_url, factura_xml_url, snapshot_emision, cliente_id, organization_id, fecha_emision, fecha_vencimiento, subtotal, iva, total, moneda, estado`.
- `fetchPagosFactura(facturaId)` — ya existe parcialmente en `usePagosFactura`; reusar.
- `fetchBitacoraFactura(facturaId)` — `from('bitacora').select(...).eq('entidad','factura').eq('entidad_id', facturaId)`.

Hooks en `src/hooks/facturacion/`:
- `useFactura(id?)` — `queryKey: queryKeys.facturas.detail(id)`.
- `useBitacoraFactura(id?)` — opcional, sólo si admin.

Keys nuevas en `src/lib/query/keys/facturas.ts`: `facturas.detail(id)`, `facturas.bitacora(id)`.

### UI (todos los archivos ≤ 200 líneas, Power of 10)

- **`src/pages/facturacion/FacturaDetalle.tsx`** (~150 ln)
  - Header sticky en mobile con número + estado badge + total grande.
  - Botón "Volver" → `/facturacion` (preservando query string si viene de la lista).
  - Acciones: Registrar pago, Marcar pagada (si admin y estado permite), Descargar PDF/XML, Ver embarque, Ver proforma origen, Regenerar (placeholder — fuera de alcance si requiere lógica nueva).
  - Permisos: usa `usePermissions()`; lectura para todos los roles internos, acciones sólo `admin`/`operador`.

- **`src/components/facturacion/detalle/FacturaResumenCard.tsx`** (~90 ln)
  - Grid con: Cliente (link a `/clientes/:id`), Expediente (link a `/embarques/:id`), Proforma origen, Fechas, Moneda, Tipo de cambio, BL ref, Notas.
  - Pills de subtotal / IVA / total.

- **`src/components/facturacion/detalle/FacturaConceptosTable.tsx`** (~80 ln)
  - Lee `snapshot_emision` (jsonb). Tabla desktop / cards mobile. Empty state si falta snapshot.

- **`src/components/facturacion/detalle/FacturaPagosSection.tsx`** (~120 ln)
  - Lista de pagos con: fecha, monto+moneda, tipo de cambio, monto aplicado en MXN, forma de pago, referencia.
  - Calcula saldo pendiente = `total − Σ monto_aplicado_factura` (helper en `financialUtils.ts`).
  - Botón "Registrar pago" (admin) abre el `DialogRegistrarPago` ya existente.
  - Acción por fila: eliminar pago (admin, con doble confirmación typable "ELIMINAR").

- **`src/components/facturacion/detalle/FacturaBitacoraCard.tsx`** (~80 ln)
  - Timeline cronológica de eventos (emisión, pagos, regeneración). Sólo visible para admin.

### Tabs internos (mobile-first)
En `<sm` se usan tabs (`Resumen | Conceptos | Pagos | Bitácora`). En desktop todas las secciones se apilan verticalmente. Patrón ya usado en `EmbarqueDetalle`.

## Portal del cliente — `/portal/facturas/:id` (ajustes)

La página ya existe; los ajustes son menores:
- **Extracción de componentes presentacionales** a `src/components/facturacion/shared/`:
  - `FacturaConceptosView` (lee snapshot, render tabla/cards) — el portal y la app la consumen.
  - `FacturaResumenGrid` (subset de campos no-sensibles).
  - `PagosList` (lista presentacional sin acciones admin).
- El portal **no recibe** botones de "Registrar pago" ni "Eliminar pago" — la versión admin envuelve los presentacionales con su barra de acciones.
- Agregar al portal: link "Ver detalle de pago" (modal read-only) si el cliente quiere ver la referencia / forma de pago de un pago aplicado.

## Permisos / Seguridad

- App: RLS existente para `facturas` ya restringe por `organization_id`. Sin cambios.
- Portal: RLS existente para `cliente` ya restringe por `cliente_id IN current_user_client_ids()`. Sin cambios.
- Mutaciones admin (registrar pago, eliminar pago) ya viven en `usePagosFactura`; reusar.

## Testing

- Unit: `fetchFacturaById` con mock supabase (caso ok, not found, RLS-bloqueado → null).
- Unit: cálculo de saldo pendiente en `financialUtils.ts` (extender tests).
- E2E (`e2e/specs/03-factura.spec.ts`): añadir flujo "abrir detalle desde lista → registrar pago → ver saldo actualizado".

## Versión y changelog

- `APP_VERSION` → `12.24.0`.
- Entrada:
  - feat(facturacion): nueva página de detalle `/facturacion/:id` con resumen, conceptos, pagos y bitácora.
  - chore(portal): componentes presentacionales de factura compartidos con la app principal.

## Fuera de alcance

- Regeneración de PDF/XML (requiere RPC nueva — decisión de producto).
- Edición de campos de la factura (la factura emitida es inmutable).
- Cancelación con CFDI (flujo SAT que requiere PAC — fuera del alcance del frontend).
- Refactor de `DialogRegistrarPago` / `DialogHistorialPagos` (se reusan tal cual).

## Riesgos

- Si `snapshot_emision` está vacío en facturas viejas → mostrar empty state, no romper.
- Si la columna `# Factura` se vuelve link, hay que verificar que `e.stopPropagation()` no rompe la selección/expansión actual de fila (test manual).
