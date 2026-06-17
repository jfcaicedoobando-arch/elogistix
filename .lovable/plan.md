# Bloque P — P&L Real por Embarque

Construir el estado financiero real de cada embarque comparando lo **presupuestado** (`conceptos_venta` / `conceptos_costo`) contra lo **realmente facturado/costeado** (`facturas` emitidas al cliente + `proveedor_facturas` de proveedores logísticos), con margen, utilidad y desglose por tipo de gasto.

## Objetivo

Hoy el P&L del embarque vive sólo en `conceptos_venta` y `conceptos_costo` (presupuesto). Tras Bloque O ya tenemos los FKs reales a `facturas` y `proveedor_facturas`, así que podemos cruzar:

- **Ingreso real** = `facturas` (estado ≠ Cancelado) ligadas al embarque + notas de crédito.
- **Costo real** = `proveedor_facturas` (estado ≠ Cancelado) ligadas al embarque + notas de crédito de proveedor.
- **Presupuestado** = `conceptos_venta` / `conceptos_costo` activos.

Se entrega como nueva pestaña **P&L** en el detalle del embarque, con totales en MXN y USD usando los tipos de cambio del embarque.

## Entregables

### 1. RPC `pnl_financiero_embarque(_embarque_id uuid)`

`SECURITY INVOKER` (respeta RLS). Devuelve una sola fila JSON con:

- Totales por bloque (MXN y USD):
  - `venta_presupuestada`, `venta_real`, `venta_facturada_pdte_cobro`
  - `costo_presupuestado`, `costo_real`, `costo_pdte_pago`
  - `utilidad_presupuestada`, `utilidad_real`, `margen_presupuestado_pct`, `margen_real_pct`
  - `desviacion_venta`, `desviacion_costo`, `desviacion_utilidad`
- Desglose por **tipo de gasto** (`concepto` agrupado): array `[{ concepto, presupuestado, real, desviacion, moneda }]`
- Desglose por **proveedor**: `[{ proveedor_id, proveedor_nombre, presupuestado, real, facturas_count }]`
- Conversión a MXN/USD usando `tipo_cambio_usd` y `tipo_cambio_eur` del embarque (mismo patrón que `estadoResultados.ts`).

### 2. Servicio y hook

- `src/features/embarques/services/pnlFinanciero.ts` → wrapper de la RPC con tipos.
- `src/features/embarques/hooks/usePnlFinanciero.ts` → React Query con `embarque_id` en queryKey, `staleTime: 30s`.

### 3. UI: nueva pestaña `TabPnl`

Ubicación: `src/features/embarques/components/tabs/TabPnl.tsx`, integrada en el detalle de embarque junto a las pestañas existentes (Costos, Facturación, Conciliación…).

Estructura:

```text
┌─ KPIs cards (4) ──────────────────────────────────────────┐
│  Venta Real | Costo Real | Utilidad Real | Margen Real %  │
│  (cada card muestra delta vs presupuestado en pequeño)    │
├─ Tabla comparativa: Presupuestado vs Real ────────────────┤
│  Concepto │ Presup MXN │ Real MXN │ Δ MXN │ Δ %           │
│  (zebra-striped, totales al pie)                          │
├─ Tabla desglose por proveedor ────────────────────────────┤
│  Proveedor │ Presupuestado │ Facturado │ # Facturas       │
├─ Badges de alerta ────────────────────────────────────────┤
│  • Sobrecosto >10% (rojo)                                 │
│  • Venta facturada < presupuestada (ámbar)                │
│  • Margen real < 15% (ámbar)                              │
└───────────────────────────────────────────────────────────┘
```

Reutiliza `DataTable`, `formatCurrency`, tokens semánticos (`text-success`, `text-destructive`, `text-warning`).

### 4. Tests

- `pnlFinanciero.test.ts` — RPC con datos seed: presupuesto sin facturas, presupuesto con factura parcial, costo real > presupuestado.
- `TabPnl.test.tsx` — render con datos mock, badges de alerta, formato MXN/USD.

### 5. Changelog & versión

- `APP_VERSION` → `13.53.0`.
- Entrada nueva en `CHANGELOG.md`.

## Detalles técnicos

**Reglas de cálculo**:
- Facturas/proveedor_facturas con `estado IN ('Cancelada','Borrador')` se excluyen del "real".
- Notas de crédito (`factura_notas_credito`, `proveedor_notas_credito`) se restan al real.
- Conversión a MXN con `tipo_cambio_usd`/`tipo_cambio_eur` del embarque (fallback a tipo de cambio de la factura si el embarque no lo tiene). Patrón ya validado en `src/lib/domain/proyeccionFacturacion/conversion.ts`.
- Agrupación por tipo de gasto: usar `conceptos_factura.descripcion` (real) vs `conceptos_venta.descripcion` (presupuestado); el match es fuzzy por `lower(trim(concepto))`.
- Margen 0 cuando venta = 0 (regla ya estandarizada en `embarqueKpis.ts`).

**RLS**: la RPC corre con `SECURITY INVOKER`; las tablas ya tienen RLS por `organization_id` y el embarque mismo. Sin cambios de policies.

**Sin migración de datos** — sólo se crea la función. Bloque O ya garantizó FKs.

## Fuera de alcance

- Marcar pagos / cobranza (queda para Bloque Q).
- Cierre financiero (Bloque S).
- Cambios en módulo Seguros (Bloque R).
- Modificar tablas existentes.
