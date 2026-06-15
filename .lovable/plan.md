# Detalle de proforma con drilldown

## Objetivo

Permitir clic en una fila de "Proformas Generadas" (tab Facturación del embarque) para abrir una página dedicada `/proformas/:id` con el detalle completo.

## Cambios

### 1. Nueva página `src/features/proformas/routes/ProformaDetalle.tsx`

Estructura siguiendo el patrón de `FacturaDetalle`:

- **Header**: número de proforma, badges (estado revisión + estado facturación), botón "Volver al embarque" (link a `/embarques/:embarque_id?tab=facturacion`), botón "Descargar PDF" (reutiliza `useDescargarProformaPdf`).
- **Card datos generales**: cliente, expediente, fecha emisión, operador, días crédito, folio factura externa (si existe).
- **Card conceptos**: `DataTable` con cantidad / descripción / moneda / precio unitario / importe / IVA (usa `fetchConceptosProforma`).
- **Card totales**: subtotal/IVA/total USD y MXN (reutiliza `calcularTotalesProforma` de `@/lib/domain/proforma`).
- **Card factura asociada** (si `facturas` no null): folio, PDF/XML download buttons.

Datos vía nuevo hook `useProformaDetalle(id)` en `src/features/proformas/hooks/useProformaDetalle.ts` que llama a una nueva query `fetchProformaPorId(id)` (un solo SELECT con join a `facturas` y `embarques(expediente, cliente_nombre, organization_id, id)`).

### 2. Ruta

- `src/routes/appRoutes.lazy.ts`: agregar `export const ProformaDetalle = lazy(() => import("@/features/proformas/routes/ProformaDetalle"));`
- `src/routes/appRoutes.tsx`: agregar `<Route path="/proformas/:id" element={<ProformaDetalle />} />` junto a las demás protegidas.

### 3. Drilldown en `HistorialProformas.tsx`

- Hacer la fila clickeable usando la prop `onRowClick` del `DataTable` (o envolver el número en `Link`). Confirmar primero qué soporta el `DataTable` compartido; si no tiene `onRowClick`, convertir la celda "Número" en un `Link to={\`/proformas/${p.id}}` con estilo de enlace primario.
- Mantener `e.stopPropagation()` en todos los botones de acciones (Descargar, Eliminar, FacturaDownloadButton) — ya están así.

### 4. Buscador global

La URL de proforma que devuelve `busqueda_global` (`/embarques/:embarqueId?tab=proformas`) se actualiza a `/proformas/:id` para que el resultado vaya directo al detalle. Migración corta: `CREATE OR REPLACE FUNCTION busqueda_global` ajustando el URL del bloque proformas.

### 5. Metadata

- `APP_VERSION` → `13.23.0` (nuevo feature de UI).
- Entrada en `CHANGELOG.md`: *"Detalle de proforma como página dedicada `/proformas/:id` con drilldown desde el tab Facturación del embarque y desde el buscador global."*

## Fuera de alcance

- No se modifica el flujo de generación/aprobación de proformas.
- No se rediseña la tabla de proformas en el embarque (sólo se agrega navegación).
- No se crea edición inline en la página de detalle (sólo lectura + descargar).

Tambien que se pueda hacer drill down desde el modulo prefacturacion, tab proformas. 