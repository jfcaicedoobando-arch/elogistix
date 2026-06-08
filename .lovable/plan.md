## Refactor del módulo Cuentas por Pagar

Objetivo: dejar CxP listo para uso real. Arreglar los modales (que se cortan), reorganizar la página y pulir tabla / detalle.

---

### 1. Modal "Capturar factura de proveedor" (prioridad alta)

Problema actual: `DialogContent` sin scroll, sin secciones, 11 inputs en grid plano, `0` literales en lugar de placeholders, total escondido entre campos.

Rediseño:
- Aplicar `dialogSize.xl + scrollableDialog` (scroll interno, max 85vh).
- Una sola columna con **secciones tituladas**:
  1. **Proveedor y folio** — Combobox proveedor + Folio.
  2. **Fechas y crédito** — Emisión, Días crédito, Vencimiento (readonly).
  3. **Moneda** — Moneda + Tipo de cambio USD (TC se oculta si moneda = MXN).
  4. **Importes** — Subtotal, IVA, Retenciones. Total destacado en un panel resumen (fondo `muted`, tabular-nums, color por moneda).
  5. **Categorización** — Categoría presupuestal + Notas.
- Inputs numéricos: `placeholder="0.00"` con value `""` mientras no se captura; convertir a number sólo al `submit`.
- Validación inline: mensajes bajo el campo (no sólo toast).
- Footer fijo (sticky) con Cancelar / Guardar.
- Extraer el formulario a `FacturaProveedorFormFields.tsx` (≤180 LOC) — el dialog queda como contenedor.

### 2. Modal "Registrar pago a proveedor"

Igual tratamiento: `dialogSize.lg + scrollableDialog`, secciones (Fecha/Método, Monto/Moneda/TC, Diferencia cambiaria opcional, Referencia/Notas), resumen "Saldo restante después del pago" en vivo, footer sticky.

### 3. Modal "Detalle de pagos"

- `dialogSize.3xl + scrollableDialog`.
- Cabecera con KPIs mini: Total factura · Pagado · Saldo · # pagos.
- Reemplazar `<table>` ad-hoc por componente con zebra-striping del sistema.
- Acción "Eliminar pago" con doble confirmación (tipear `ELIMINAR`) — sigue regla data-safety.

### 4. Página `/cxp`

- **KPIs**: añadir conteo de facturas en cada tarjeta (ej. "Por pagar MXN · 12 facturas"). Mantener 4 tarjetas.
- **Filtros**: adoptar patrón embarques — barra compacta `Search + Estatus + Moneda + Filtros (N)`. En el `Sheet` lateral: filtro por **Proveedor** (nuevo) y rango de fechas de emisión. Chips de filtros activos debajo (`CxpFiltrosChips`).
- **Acciones header**: dejar sólo Reporte PDF + Capturar factura (sin cambios mayores).
- **Tabla**:
  - Densidad `compact` por defecto (consistente con embarques).
  - Fila clicable → abre "Detalle de pagos" (con `e.stopPropagation` en acciones, ya está).
  - Ordenamiento por defecto: días vencido desc, luego vencimiento asc.
  - Columna acciones: dejar `Pagar` siempre visible cuando aplique, mover ojo/borrar a un `DropdownMenu` (`MoreHorizontal`) para reducir ruido visual.
- **Empty state**: ilustración + texto + CTA "Capturar primera factura" (si admin).

### 5. Misc

- Filtro por proveedor llega al servicio `fetchFacturasCxP` (extiende `FetchCxPFiltros`).
- Actualizar `CHANGELOG.md` y bump `APP_VERSION` (12.62.0).

---

### Archivos afectados

**Nuevos**
- `src/components/cxp/FacturaProveedorFormFields.tsx`
- `src/components/cxp/PagoProveedorFormFields.tsx`
- `src/components/cxp/CxpFiltros.tsx`
- `src/components/cxp/CxpFiltrosChips.tsx`

**Editados**
- `src/components/cxp/DialogNuevaFacturaProveedor.tsx` — adelgazar, usar form fields + scrollable.
- `src/components/cxp/DialogRegistrarPagoProveedor.tsx` — secciones + saldo restante.
- `src/components/cxp/DialogDetallePagosProveedor.tsx` — KPIs + tabla mejorada + doble confirm.
- `src/components/cxp/cxpColumns.tsx` — dropdown acciones, defaults sort.
- `src/pages/cxp/Cxp.tsx` — nuevos filtros, KPIs con count, empty state, click en fila.
- `src/services/cxp/*` — extender filtros (proveedor_id, fecha rango). _Solo capa de lectura, sin cambios de schema._
- `src/constants/appVersion.ts` y `CHANGELOG.md`.

### Fuera de alcance
- Cambios al schema de BD (`proveedor_facturas`, `proveedor_pagos`).
- Conciliación con tesorería / pagos masivos.
- Importación CSV de facturas.
- Edición de facturas existentes (sólo se mantiene crear + eliminar).
