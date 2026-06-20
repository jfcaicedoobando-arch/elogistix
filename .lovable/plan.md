
# Panel de Pendientes Administrativos (sin estado nuevo)

Mantenemos los 7 estados actuales. Agregamos visibilidad sobre el "limbo administrativo" entre EIR/Entregado y Cerrado, reusando `validar_cierre_embarque` que ya valida CxC, CxP, documentos y comisiones.

## Qué se agrega

### 1. Sub-badge "Admin pendiente" en lista y detalle
En embarques con estado **EIR** (marítimo) o **Entregado** (resto) que aún no están Cerrados:
- Badge ámbar al lado del estado: `Admin pendiente · 2`
- El número = cantidad de checks que fallan en `validar_cierre_embarque`.
- Verde `Listo para cerrar` cuando todos los checks pasan.

### 2. Nueva pestaña "Cierre Administrativo" en el detalle del embarque
Solo visible cuando estado ∈ {EIR, Entregado}. Muestra checklist en vivo:

```
✅  Documentos completos
⚠   Cobranza pendiente — Factura F-001 ($12,400 MXN)     [Ir a CxC]
⚠   Pago a proveedor pendiente — MAERSK ($2,400 USD)     [Ir a CxP]
✅  Comisión calculada
─────────────────────────────────────────
        [ Cerrar embarque ]   (deshabilitado hasta que todo esté ✅)
```

Reutiliza `validarCierre(embarqueId)` que ya existe en `services/cierre.ts`.

### 3. Filtros en lista de embarques
Chip de filtro rápido:
- `Listos para cerrar` (todos los checks ✅, aún no Cerrado)
- `Admin pendiente` (al menos un check ⚠)

### 4. Alerta en sidebar
Nuevo contador en `useSidebarAlerts`:
- **Administración/Finanzas (admin, contabilidad, cobranza):** ven todos los embarques con admin pendiente de su organización.
- **Operativo:** ve solo embarques donde es responsable operativo + un badge informativo (no crítico, color gris).
- **Vendedor:** ve solo embarques donde es el vendedor asignado (para seguimiento de comisión).

Una sola RPC `embarques_admin_pendientes_count(p_scope)` que devuelve el conteo filtrado según rol/usuario.

### 5. Permiso de "Cerrar embarque"
Solo roles administrativos pueden pulsar el botón final de Cerrar. El operativo ve el panel pero el botón está deshabilitado con tooltip "Solo administración puede cerrar".

## Lo que NO cambia
- Sin estado nuevo en `ESTADOS_EMBARQUE`.
- Sin migración de datos.
- Timeline de fases (Cotización → Confirmado → Tránsito → Llegada → Cerrado) intacto.
- Reportes y filtros existentes siguen funcionando.

## Detalle técnico

**Backend:**
- Nueva RPC `embarques_admin_pendientes(p_org_id, p_scope_user_id)` que devuelve `{embarque_id, file, checks_pendientes[], cliente, monto_pendiente_cxc, monto_pendiente_cxp}` para listas y contadores. Reutiliza la misma lógica de `validar_cierre_embarque` aplicada a múltiples embarques.
- Index parcial en `embarques (organization_id, estado) WHERE estado IN ('EIR','Entregado')` para acelerar.

**Frontend:**
- `src/features/embarques/components/TabCierreAdministrativo.tsx` (nuevo, ~150 líneas).
- `src/features/embarques/components/EmbarqueDetalleTabs.tsx` — registrar la pestaña condicional.
- `src/features/embarques/components/EmbarqueBadgeAdmin.tsx` (nuevo) — sub-badge reutilizable en lista y detalle.
- `src/features/embarques/hooks/useAdminPendienteResumen.ts` (nuevo).
- `src/hooks/layout/useSidebarAlerts.ts` — agregar `adminPendientesCount` con filtro por rol.
- `src/components/layout/sidebarItems.ts` — badge en el item de Embarques.
- `src/features/embarques/services/cierre.ts` — añadir `fetchAdminPendientes(scope)`.

**Versión y changelog:**
- `APP_VERSION` → `13.89.0`
- Entrada en `CHANGELOG.md`: panel de cierre administrativo, badges, filtros, alertas por rol.

## Próximo paso después de implementar (no incluido aún)
Notificación automática al admin cuando un embarque entra a EIR/Entregado con `admin_pendiente > 0` por más de N días. Lo dejamos para otra iteración.
