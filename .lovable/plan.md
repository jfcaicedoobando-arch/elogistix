
# Mejorar Tab Costos del embarque

## Objetivo
Enfocar el tab **Costos** en el análisis de costos reales vs cotizados, eliminando duplicidad con el tab Facturación y exponiendo la información de la factura de proveedor con la que cada concepto fue conciliado.

## Cambios

### 1. Quitar la carta "Conceptos de Venta"
- En `src/features/embarques/components/TabCostos.tsx` eliminar:
  - La sección `<Card>` de Conceptos de Venta (líneas ~123-143).
  - Definición de `ventaColumns` y el prop `conceptosVenta` (queda sólo `totalVenta` para el KPI).
- Actualizar `EmbarqueDetalleTabs.tsx` para dejar de pasar `conceptosVenta` al `TabCostos` (esa data queda únicamente en Facturación).
- Los 4 KPIs (Total Venta / Total Costo / Utilidad / Margen) se conservan intactos.

### 2. Mostrar información de la factura de proveedor por concepto
Actualmente `TabCostos` ya usa `useCostosConFactura` sólo para saber si existe factura (Set de ids). Se sustituye por el pipeline de reconciliación que ya devuelve facturas ligadas por concepto.

- Nuevo hook `useReconciliacionCostos(embarqueId)` (o reutilizar `fetchReconciliacionCostos` existente en `reconciliacionCostos.ts`) que devuelve `FilaReconciliacion[]` con:
  - `facturas: FacturaVinculada[]` (folio_proveedor, fecha_emision, monto, proveedor_factura_id).
  - `real_facturado`, `diferencia`, `desviacion_pct`, `estatus_renglon`.
- Extender la consulta para traer también `estatus_pago` de `proveedor_facturas` (Pagada / Pendiente / Vencida) — se agrega al tipo `FacturaVinculada` y a `PFCRow.proveedor_facturas`.
- Nuevas columnas en la tabla de costos (después de Monto):
  - **Facturado**: monto real (rojo/verde tenue según desviación).
  - **Δ vs cotizado**: diferencia y % (badge de estatus_renglon: Sin match / Parcial / Conciliado / Excedente).
  - **Factura(s)**: chips con `Folio · dd/MM/yyyy`, con tooltip mostrando monto y estado de pago. Click abre la factura de proveedor en el módulo Compras (`/compras/facturas/:id`). Si hay varias, se muestran apiladas.
  - **Pago**: badge Pagada / Pendiente / Vencida (usa `estatus_pago`; si hay varias facturas, muestra el peor estado).
- La columna existente "Liquidación" pasa a derivarse del `estatus_renglon` para ser consistente (Sin match ≙ Pendiente).

### 3. Agrupar costos por proveedor
- Reemplazar la `DataTable` plana dentro de `ConceptosCostoCard` por una lista de sub-tablas, una por proveedor, ordenadas alfabéticamente.
- Cada grupo:
  - Encabezado sticky con nombre del proveedor + contador de conceptos + **subtotal por moneda** (cotizado / facturado / diferencia).
  - Tabla compacta con las columnas descritas arriba.
  - Collapsible (abierto por defecto). Estado persistido sólo en memoria.
- Al final de la carta, fila de **totales por moneda** (MXN, USD por separado) con cotizado, facturado y diferencia.

### 4. Versionado + changelog
- Bump `APP_VERSION` → `13.216.0` (feature menor).
- Entrada en `CHANGELOG.md` describiendo los tres cambios.

## Fuera de alcance
- Tab Facturación: no se toca.
- Módulo de Compras: no cambia; sólo se linkea desde los chips.
- Lógica de reconciliación masiva ya implementada: se reutiliza tal cual.

## Detalles técnicos
- Archivos principales a editar:
  - `src/features/embarques/components/TabCostos.tsx`
  - `src/features/embarques/components/costos/ConceptosCostoCard.tsx`
  - `src/features/embarques/components/EmbarqueDetalleTabs.tsx` (props)
  - `src/features/embarques/services/reconciliacionCostos.helpers.ts` (agregar `estatus_pago` a `FacturaVinculada` + `PFCRow`)
  - `src/features/embarques/services/reconciliacionCostos.ts` (select con `estatus_pago`)
  - `src/features/embarques/hooks/` (nuevo `useReconciliacionCostos.ts`)
  - `src/constants/appVersion.ts`, `CHANGELOG.md`
- Se respeta ≤200 líneas por componente extrayendo `GrupoCostosProveedor.tsx` para cada grupo.
- Tests: añadir un test unitario al helper de agrupación por proveedor + moneda (subtotales) y ampliar el fixture del helper existente para cubrir `estatus_pago`.
