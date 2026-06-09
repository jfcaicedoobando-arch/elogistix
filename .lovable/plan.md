# Estudio de roles — Libre Carga ERP

## 1. Situación actual

**Enum `public.app_role`** (6 valores): `super_admin`, `admin`, `operador`, `vendedor`, `viewer`, `cliente`.

**Distribución real en `user_roles`:** operador 6 · cliente 3 · admin 2 · viewer 2 · super_admin 1 · vendedor 0.

**Helpers en `usePermissions`:**
- `canEdit` = admin / operador / super_admin
- `canViewFinancials` = todos menos operador
- `canEditCrm` = canEdit o vendedor

**Módulos cubiertos hoy:** Dashboards · Cotizaciones · Embarques · Pre-Facturación · CxP · Tesorería · Comisiones · Profit (Ejecutivo / Proyección / EERR / Presupuesto) · CRM · Reportes · Clientes · Proveedores · Auditoría · Bitácora · Sentry · Usuarios · Papelera · Idempotencia · Configuración · Panel Super Admin · Portal Cliente.

## 2. Problemas detectados

1. **`admin` es un "súper usuario funcional"**: edita CRM, factura, autoriza pagos, configura tasas, da de alta usuarios. No hay separación de funciones — auditoría externa lo va a marcar.
2. **`operador` es un cajón único**: traffic, pricing, documentación, supervisores — todos heredan los mismos permisos sin matiz.
3. **No existe rol financiero/contable**. Solo admin toca CxP, Tesorería, Comisiones, EERR.
4. **No hay rol de gerencia "lectura+aprobación"** sin permisos destructivos.
5. **`vendedor` solo ve CRM**: en un forwarder el KAM necesita ver embarques y cobranza de sus clientes.
6. **`viewer` ve todo, incluso financiero**: cualquier invitado expone P&L y márgenes.
7. **`cliente` ya existe pero no está documentado** junto al resto (vive en otro flujo: portal).
8. **No hay rol "tracking-only"** para soporte/CS que necesita consultar estatus sin tocar nada.

## 3. Roles propuestos (10)

| # | Rol | Propósito | Edita | Ve finanzas | Admin |
|---|-----|-----------|-------|-------------|-------|
| 1 | `super_admin` | Plataforma (cross-tenant) | Todo | Sí | Sí + impersonar |
| 2 | `admin_org` | Dueño / Gerente general del tenant | Todo en su org | Sí | Sí (usuarios, config) |
| 3 | `gerente_operaciones` | Supervisa operación, aprueba | Operación + lee finanzas | Sí | No |
| 4 | `coordinador_logistico` *(antes `operador`)* | Embarques, tracking, docs | Cotiza/embarca/factura | **No** (sin profit/costos) | No |
| 5 | `ejecutivo_pricing` | Arma cotizaciones y P&L preliminar | Cotizaciones + costos | Sí (en su cotización) | No |
| 6 | `contador` | Facturación, CxC, CxP, EERR, conciliación | Facturas, pagos, NC | Sí (completo) | No |
| 7 | `tesorero` | Pagos a proveedores, conciliación bancaria, comisiones | CxP/Tesorería/Comisiones | Sí (flujo) | No |
| 8 | `vendedor` *(ampliado a KAM)* | CRM + visibilidad de sus clientes | CRM + lectura embarques/cobranza de sus cuentas | Sólo de sus cuentas | No |
| 9 | `customer_service` *(nuevo, antes `viewer`)* | Atención al cliente, tracking, soporte | **Solo lectura** operativa, sin finanzas | No | No |
| 10 | `cliente` | Portal externo | Sus propios datos | Sus facturas | No |

## 4. Matriz de permisos por módulo

```text
Módulo             super  admin  ger_op coord  pricing cont   tes    vend   cs    cliente
Dashboard Princ.    RW     RW     RW     RW     RW      RW     RW     R*    R     —
Operaciones         RW     RW     RW     RW     R       R      R      R*    R     —
Cotizaciones        RW     RW     RW     RW     RW      R      —      R*    R     —
Embarques           RW     RW     RW     RW     R       R      —      R*    R     —
Pre-Facturación     RW     RW     RW     R      —       RW     R      —     —     —
CxP                 RW     RW     R      —      —       RW     RW     —     —     —
Tesorería           RW     RW     R      —      —       R      RW     —     —     —
Comisiones          RW     RW     R      —      —       R      RW     R*    —     —
Profit / EERR       RW     RW     R      —      R       RW     R      —     —     —
CRM                 RW     RW     RW     —      —       —      —      RW    R     —
Reportes            RW     RW     R      R(op)  R       R      R      R*    —     —
Clientes            RW     RW     RW     RW     R       R      R      RW*   R     R(self)
Proveedores         RW     RW     RW     RW(log) —      RW(all) R     —     —     —
Auditoría/Bitácora  RW     R      R      —      —       R      R      —     —     —
Usuarios/Config     RW     RW     —      —      —       —      —      —     —     —
Papelera/Idempot.   RW     RW     —      —      —       —      —      —     —     —
Panel Super Admin   RW     —      —      —      —       —      —      —     —     —
Portal              —      —      —      —      —       —      —      —     —     RW(self)
```
Leyenda: `RW`=lee/edita · `R`=lee · `R*`=sólo sus cuentas asignadas · `—`=sin acceso · `RW(log)`=solo subcategoría Logístico · `RW(all)`=incluye gastos operativos.

## 5. Cambios necesarios

**BD (1 migración):**
- `ALTER TYPE public.app_role ADD VALUE` para: `admin_org`, `gerente_operaciones`, `coordinador_logistico`, `ejecutivo_pricing`, `contador`, `tesorero`, `customer_service`.
- Backfill: `admin` → `admin_org`; `operador` → `coordinador_logistico`; `viewer` → `customer_service`. `super_admin`, `vendedor`, `cliente` se conservan.
- Conservar los valores viejos del enum (Postgres no permite borrarlos) y dejarlos como deprecated en código.
- Nuevas funciones SECURITY DEFINER de utilería: `is_finance(_uid)`, `is_operations(_uid)`, `is_sales(_uid)`, `can_view_financials(_uid)`. Las políticas RLS pasan a usarlas para no listar 7 roles en cada policy.

**Código:**
- `src/types/appRole.ts` ya deriva del enum — se actualiza solo tras la migración.
- `src/hooks/shared/usePermissions.ts`: reemplazar booleans hardcoded por matriz declarativa (`PERMISSIONS[role][module] → 'rw'|'r'|'none'`). API pública conserva `canEdit`, `canViewFinancials`, `canEditCrm` para no romper 36 consumidores; se agregan `canEditFinance`, `canApprove`, `canAdminTenant`.
- `src/hooks/layout/useAppSidebarSections.ts`: nueva tabla rol→secciones visibles (hoy son `if/else` por rol; pasar a config).
- `src/pages/admin-org/Usuarios.tsx` y wizard de alta: nuevos labels en español ("Coordinador logístico", "Contador", etc.) + tooltips con la matriz.

**RLS (revisión, no destructiva):**
- Las 526 llamadas a `has_role()` siguen funcionando.
- Se agregan policies adicionales para `contador`/`tesorero` donde hoy sólo `admin` puede escribir (facturas, pagos_factura, pagos_proveedor, factura_notas_credito, comisiones_devengadas).
- Restringir `customer_service` quitándole acceso de lectura a tablas financieras (`cotizacion_costos`, `conceptos_costo`, `comisiones_devengadas`, `pagos_*`, `proveedor_facturas`, `presupuesto_*`, `factura_notas_credito`).

**UI nueva:**
- Pantalla `/configuracion/roles` (sólo `admin_org` y `super_admin`): muestra la matriz como referencia + lista de usuarios por rol.

## 6. Versionado y changelog

- `APP_VERSION` → `12.66.0`.
- Entrada en `CHANGELOG.md`: "feat(seguridad) — matriz de 10 roles con separación de funciones; backfill admin→admin_org, operador→coordinador_logistico, viewer→customer_service".

## 7. Fuera de alcance (siguiente iteración)

- Permisos a nivel registro (ej. vendedor sólo ve sus oportunidades) — ya hay scaffolding parcial con `crm_oportunidades.vendedor_id`.
- Roles compuestos / multi-rol por usuario (hoy un usuario = un rol por organización).
- Auditoría de cambios de rol con motivo obligatorio.
- Aprobaciones formales (workflow): hoy `gerente_operaciones` "aprueba" implícitamente al cambiar estado, sin firma.

---

**Decisión solicitada:** ¿procedo a implementar los 10 roles tal como están en la matriz, o querés ajustar algún rol (fusionar `contador`+`tesorero`, partir `coordinador_logistico` en `traffic` vs `documentacion`, etc.) antes de tocar BD?
