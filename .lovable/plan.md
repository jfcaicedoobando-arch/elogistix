## Fase B — Control financiero del módulo de Compras

Objetivo: llevar el módulo al estándar ERP con **aging de cuentas por pagar, flujo de aprobación de facturas, notas de crédito de proveedor y salud del proveedor**. Todo respeta multi-tenant (organization_id), RLS, y los estándares ya definidos (DataTable, PageHeader, financialUtils, fechas UTC).

---

### 1. Aging de Cuentas por Pagar (CxP)

**Qué construye:** vista de antigüedad de saldos por proveedor con cubetas estándar.

- Nueva RPC `cxp_aging_proveedores(p_org uuid, p_fecha date)` que devuelve por proveedor:
  - `saldo_total`, `vigente` (0 días vencido), `1_30`, `31_60`, `61_90`, `mas_90`
  - Calcula desde `proveedor_facturas` (saldo_pendiente > 0) usando `fecha_vencimiento` vs `p_fecha`.
- Nueva pestaña **"Antigüedad"** en `ComprasTabStrip` → ruta `/compras/aging`.
- Página `CxpAging.tsx`:
  - PageHeader + 5 KPI cards (una por cubeta, totales en MXN).
  - DataTable con columnas: Proveedor, Vigente, 1-30, 31-60, 61-90, >90, Total. Click en proveedor → `/cxp?proveedor={id}`.
  - Gráfica de barras apiladas (recharts) por las 5 cubetas top 10 proveedores.
  - Botón "Exportar CSV".

### 2. Flujo de aprobación de facturas de proveedor

**Qué construye:** estado de aprobación antes de programar pago.

- Migración: añadir a `proveedor_facturas`:
  - `estado_aprobacion` enum (`pendiente`, `aprobada`, `rechazada`) default `pendiente`
  - `aprobada_por uuid`, `aprobada_at timestamptz`, `motivo_rechazo text`
- Backfill: facturas existentes con pagos > 0 → `aprobada`; resto → `pendiente`.
- RPC `aprobar_factura_proveedor(p_id, p_aprobar bool, p_motivo text)` con check de rol (admin/finanzas).
- UI en `DialogDetallePagosProveedor`:
  - Badge de estado de aprobación arriba.
  - Botones **Aprobar** / **Rechazar** (solo roles autorizados, solo si `pendiente`).
  - Bloquear creación de pagos si `estado_aprobacion != 'aprobada'`.
- Nueva tab/filtro "Por aprobar" en `/cxp` con badge contador en sidebar.
- Registrar en `bitacora_actividad`.

### 3. Notas de crédito de proveedor

**Qué construye:** aplicar NC del proveedor contra una factura para reducir saldo.

- La tabla `proveedor_notas_credito` ya existe (17 columnas). Verificar campos y RLS.
- Servicio `proveedorNotasCredito.ts` (CRUD + aplicar/cancelar).
- UI dentro de `DialogDetallePagosProveedor`:
  - Sección "Notas de crédito" con tabla (folio, fecha, monto, aplicado, saldo).
  - Botón "Registrar nota de crédito" → dialog con folio, fecha, monto, motivo, archivo XML/PDF opcional.
  - Botón "Aplicar a factura" → reduce `saldo_pendiente` y marca NC como aplicada.
- Recalcular `saldo_pendiente` de la factura usando `pagos + notas_credito_aplicadas`.
- Reflejar en aging y en "Por pagar".

### 4. Salud del Proveedor

**Qué construye:** scorecard por proveedor.

- RPC `proveedor_salud(p_proveedor_id uuid)` que devuelve:
  - Facturas últimos 12 meses (count, monto), saldo actual, días promedio de pago,
  - % facturas pagadas a tiempo, NC emitidas, embarques activos.
- Nueva pestaña **"Salud"** en la página de detalle de proveedor (`ProveedorDetalle`):
  - 6 KPI cards + gráfica de barras de gasto mensual (últimos 12 meses) + tabla últimas 10 facturas con estado.
  - Indicador semáforo (verde/amarillo/rojo) basado en % pagadas a tiempo.

### 5. Hub `/compras` — actualización

- Sumar KPI "Por aprobar" y "Saldo vencido (>30d)" al resumen.
- Quick action "Revisar aging".

---

### Detalles técnicos

- **Migración SQL única** con: alter `proveedor_facturas`, las 3 nuevas RPCs (`cxp_aging_proveedores`, `aprobar_factura_proveedor`, `proveedor_salud`), GRANTs y RLS donde aplique. Las RPCs son SECURITY DEFINER con check de membresía via `organization_members`.
- **Archivos nuevos:** `CxpAging.tsx`, `cxpAgingColumns.tsx`, `useCxpAging.ts`, `DialogNotaCreditoProveedor.tsx`, `proveedorNotasCredito.ts`, `useProveedorSalud.ts`, `ProveedorSaludTab.tsx`, `BotonesAprobacionFactura.tsx`.
- **Archivos editados:** `ComprasTabStrip.tsx` (+Antigüedad), `Compras.tsx` (+KPIs), `Cxp.tsx` (+filtro aprobación), `DialogDetallePagosProveedor.tsx` (aprobación + NC), `ProveedorDetalle.tsx` (+tab Salud), `sidebarItems.ts` (badge "Por aprobar"), `appRoutes.tsx`+lazy+smoke, `CHANGELOG.md`, `appVersion.ts` → `13.101.0`.
- Cálculos monetarios siempre con `financialUtils.ts` y `currency.js`. Fechas con utilidades UTC ya estandarizadas.
- Cleanup en `useEffect` con canales realtime si se añaden.
- Componentes ≤200 líneas (Power of 10).

### Fuera de alcance (Fase C/D)

Órdenes de compra, recepción de mercancía, propuesta de pago, conciliación bancaria, DIOT, CFDI 4.0 complemento de pagos, validación 69-B SAT, 3-way matching.

¿Procedo con esta Fase B completa, o prefieres dividirla (ej. solo Aging + Aprobación primero, luego NC + Salud)? Completa

&nbsp;