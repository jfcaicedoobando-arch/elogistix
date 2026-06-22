## Pendientes del módulo de Compras

La Fase B se entregó en su mayoría (Aging, RPC de aprobación, NC de proveedor y tab Salud). Quedaron sueltos varios "enganches" de UI/UX y reglas que el plan original sí contemplaba.

### 1. Tab "Por aprobar" en `/cxp`

- Añadir filtro `estado_aprobacion` en `CxpFiltros` (chips: Todas / Pendientes / Aprobadas / Rechazadas).
- Columna nueva "Aprobación" con badge en `cxpColumns`.
- Quick filter "Por aprobar" en el hub.

### 2. Badge contador en sidebar

- RPC liviana `cxp_pendientes_aprobacion_count()` (o query directa).
- Hook `useCxpPendientesAprobacion` y badge numérico en el item "Compras" del sidebar (`sidebarItems.ts` / `sidebarRoleBuilders.ts`).

### 3. Bloqueo de pagos si no está aprobada

- En `DialogRegistrarPagoProveedor` y en el botón "Registrar pago" de `cxpColumns`: deshabilitar + tooltip "Requiere aprobación" cuando `estado_aprobacion !== 'aprobada'`.
- Validación server-side: chequeo dentro del insert de `pagos_proveedor` (trigger BEFORE INSERT) para que ningún cliente lo saltee.

### 4. KPIs nuevos en el hub `/compras`

- "Por aprobar" (count + monto).
- "Saldo vencido > 30 días" (suma cubetas 31-60, 61-90, >90 desde `cxp_aging_proveedores`).
- Quick action "Revisar aging" → `/compras/aging`.

### 5. Backfill de facturas existentes

- Migración: `UPDATE proveedor_facturas SET estado_aprobacion='aprobada' WHERE pagado > 0`.
- Resto queda `pendiente` (ya es el default).

### 6. Limpieza / consistencia

- Pestaña "Antigüedad" ya existe en `ComprasTabStrip` ✔.
- Registrar aprobación/rechazo en `bitacora_actividad` (verificar que el RPC ya lo haga; si no, añadirlo).

### Archivos a tocar

- **SQL (1 migración):** trigger `pagos_proveedor_requiere_aprobacion`, RPC `cxp_pendientes_aprobacion_count`, backfill UPDATE.
- **Edit:** `CxpFiltros.tsx`, `cxpColumns.tsx`, `Cxp.tsx`, `Compras.tsx`, `DialogRegistrarPagoProveedor.tsx`, `sidebarItems.ts`, `sidebarRoleBuilders.ts`, `CHANGELOG.md`, `appVersion.ts` → `13.102.0`.
- **Nuevo:** `useCxpPendientesAprobacion.ts`.

### Fuera de alcance (Fase C)

Órdenes de compra, recepción, propuesta de pago, conciliación bancaria, DIOT, CFDI 4.0 complemento, 3-way matching.

¿Avanzo con todos los pendientes en una sola entrega, o prefieres priorizar (ej. primero badge + bloqueo de pago, después KPIs del hub)?  Todos