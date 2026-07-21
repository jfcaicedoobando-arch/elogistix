# Design Language uniforme — Modales de Compras

## Contexto

En `v13.303.94` se estableció el design language "Card grid estructurada" en `DialogDetallePagosProveedor`. En `v13.303.95` (Lote 1) se extendió a `DialogRegistrarPagoProveedor` y `AgingDrillDownDialog`. Falta homologar el resto de modales del módulo `/compras`.

**Piezas del design language a propagar:**

1. **Chip-folio inline** con el título (badge mono, uppercase, `bg-muted border`).
2. **Banda de contexto** (`bg-accent/5 border`) con dot de estado + alertas breves (vencida, cancelada, no aprobada).
3. **KPI grid** de 2–4 columnas usando el componente `Kpi` (`DialogDetallePagosProveedor.parts.tsx`) con `tone` (`default | success | warn | destructive`) y `emphasis` (ring) en la métrica dominante.
4. Secciones estructuradas y tipografía consistente (`text-2xs uppercase tracking-wide` en labels de KPIs).

## Alcance — modales a homologar

### 1. `DialogNuevaFacturaProveedor.tsx`
- Header: reemplazar el `headerAside` de "Total" texto plano por un mini-KPI grid embebido — Total (emphasis), Subtotal, IVA, Retenciones — usando `Kpi`.
- Eliminar la fila de totales del footer (queda redundante) y dejar sólo las acciones Cancelar/Guardar.
- La barra `CuadreConceptosBar` ya cumple el rol de banda de contexto; mantenerla al final del body.

### 2. `DialogEditarFacturaProveedor.tsx`
- Header: mover folio interno + folio proveedor a **chip-folio** inline con el título.
- Reemplazar `headerAside` por KPI grid (Total emphasis, Subtotal, IVA, Ret, Moneda).
- Sustituir los banners custom `BannerPagos` / `BannerReaprobacion` por la **banda de contexto** unificada (`bg-accent/5 border` con icono + texto), colocada arriba del formulario. El banner de pagos usa tono `warning`; el de re-aprobación tono `primary`.
- Simplificar footer igual que Nueva.

### 3. `DialogNotaCreditoProveedor.tsx`
- Header: chip-folio (factura origen) + subtítulo con proveedor.
- Añadir KPI grid superior: **Saldo factura** (emphasis, `warn` si > 0), Moneda, Motivo seleccionado. `description` deja de mostrar el saldo (queda en KPI).
- Subir tamaño de `md` → `lg` para acomodar la banda superior sin comprimir el form.
- Convertir el warning inline "excede el saldo" en la misma banda de contexto (`bg-destructive/5`).

### 4. `CancelarFacturaProveedorDialog.tsx` (ConfirmActionDialog)
- Insertar como primer child (encima del textarea de motivo) una **banda de contexto** compacta con: chip-folio interno, folio prov., proveedor, y KPI mini (Total, Pagado, Saldo, Moneda). Ayuda a decidir antes de tipear CANCELAR.
- Mantener el flujo destructivo actual.

### 5. `CerrarFacturaSinPagoDialog.tsx` (ConfirmActionDialog)
- Misma banda superior que Cancelar, con `emphasis` en **Saldo**.
- Reemplazar el `formatCurrency(factura.saldo, ...)` embebido en el `description` por texto conceptual (ya lo cubre la KPI band).

### 6. `EliminarFacturaCxpDialog.tsx`
- Añadir chip-folio + una KPI mini de una sola línea (Folio prov., Total, Estado) para dar contexto antes de eliminar.

## Reutilización

Todos los modales importarán:
- `Kpi` desde `./DialogDetallePagosProveedor.parts`.
- Un nuevo helper compartido `FacturaContextoBand` en `src/features/cxp/components/FacturaContextoBand.tsx` que encapsula: **chip-folio + banda + KPI grid** parametrizados (`variant: "full" | "compact"`, `emphasis: "total" | "saldo" | null`). Esto evita duplicar markup entre los 6 modales y facilita futuros modales de CxP.

## Detalles técnicos

- Sin cambios en hooks, RPCs, servicios ni tests de lógica. Es un refactor puramente presentacional.
- Cada archivo se mantiene ≤ 200 líneas (regla Power of 10); extraer sub-componentes si un modal crece.
- Tests: agregar snapshot ligero de `FacturaContextoBand` (render en dos variantes) para prevenir regresiones visuales.
- `APP_VERSION` → `13.303.98`.
- `CHANGELOG.md`: entrada breve "Design language uniforme en modales de Compras".

## Fuera de alcance

- `CrearProveedorDesdeCfdiDialog` (crear proveedor, no gira en torno a una factura → no aplica el chip-folio/KPI de factura).
- `AgingDrillDownDialog` y `DialogRegistrarPagoProveedor` (ya homologados en Lote 1).
- Cambios funcionales en cancelación, cierre, NC, edición o creación.

## Diagrama de la banda unificada

```text
+--------------------------------------------------------------+
| [FP-000039]  Folio prov. A-123 · Proveedor SA                |
+--------------------------------------------------------------+
| ● Por aprobar   |   Vencida · 12 d                           |
+--------------------------------------------------------------+
| Total          | Pagado        | Saldo (emph) | Moneda · TC   |
| $19,150.00 USD | $0.00         | $19,150.00   | USD · 17.85   |
+--------------------------------------------------------------+
```
