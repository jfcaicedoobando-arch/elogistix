# Reasignar responsabilidades: Ejecutivo de Pricing ↔ Vendedor / KAM

## Cambio de responsabilidades

| Rol | Antes | Ahora |
|---|---|---|
| **Ejecutivo de Pricing** | Armaba cotizaciones con P&L | **Trabaja Costeo y negocia tarifas con partners (navieras / agentes / transportistas).** Mantiene cotizaciones y comisiones, pero su día a día es Costeo + Proveedores. |
| **Vendedor / KAM** | CRM + sus embarques/cobranza | **Arma cotizaciones con costos y P&L preliminar de sus cuentas, ve márgenes de sus cotizaciones, y hace handoff al Coordinador Logístico cuando el cliente confirma.** |

## Analogía
Hoy ambos puestos competían por la misma silla de "armador de cotización". Vamos a separarlos: Pricing se queda en la **cocina** (negociando ingredientes con proveedores y armando la receta de costos base). Vendedor se sienta en la **caja registradora con la receta lista** (arma la cotización al cliente con márgenes, y cuando el cliente acepta se la pasa al mesero — Coordinador Logístico — que la ejecuta).

---

## 1) Permisos (matriz)

Archivo: `src/hooks/shared/usePermissions.ts`

**Ejecutivo de Pricing**
- Sigue en `OPERATIONS` (necesita editar Costeo, que vive en gestión).
- Sigue en `SALES` (puede ver/colaborar en cotizaciones, pero ya no es su foco).
- Sigue en `FINANCE_VIEWERS` (necesita ver márgenes para negociar).
- **Se mantiene** `OVERRIDE_TARIFA_PRICING`: queda en `["super_admin","admin_org","admin","gerente_comercial"]` (no cambia — el override sigue siendo de Gerente Comercial; pricing **propone**, comercial **aprueba**).

**Vendedor / KAM**
- Agregar a `OPERATIONS` → ahora puede operar cotizaciones (no embarques completos; el módulo de embarques sigue siendo del coordinador para el handoff).
- Agregar a `FINANCE_VIEWERS` → ve márgenes y P&L preliminar **de sus cotizaciones** (filtro por owner ya existe a nivel de query en cotizaciones / oportunidades).
- Sigue en `SALES`.

**Nueva capacidad: `canHandoffCotizacion`** — habilita el botón "Convertir a embarque / handoff" en el detalle de cotización confirmada. Roles permitidos: `vendedor`, `gerente_comercial`, `gerente_operaciones`, `coordinador_logistico`, admins. (Hoy el flujo de cotización→embarque ya existe; sólo formalizamos el permiso.)

> Nota: el filtrado fino "ve sólo márgenes de **sus** cotizaciones" se hace en data (RLS / filtros por `creado_por` o `vendedor_email`), no aquí. Esta matriz sólo abre la capacidad de UI. Si una RLS restringe más, manda RLS.

---

## 2) Sidebar

Archivo: `src/hooks/layout/sidebarRoleBuilders.ts`

**`buildEjecutivoPricing`** — pasa de generalista a especialista de costos:
```text
Dashboards
Costeo                  ← principal
Gestión: Cotizaciones   (vista para consultar referencias, no su foco)
Directorio: Proveedores, Clientes   ← agregar Proveedores (partners)
Reportes
Sistema: Ayuda
```
Se quita "embarques" del filtro de Gestión (ya no opera embarques).

**`buildVendedor`** — gana cotizaciones, costeo limitado y profit:
```text
Dashboards               ← agregar
CRM
Gestión: Cotizaciones    ← agregar (su nueva responsabilidad principal)
Costeo                   ← agregar (para usar tarifas vigentes al armar)
Profit                   ← agregar (P&L preliminar de sus cotizaciones)
Directorio: Clientes
Sistema: Ayuda
```

---

## 3) Descripciones del catálogo

Archivo: `src/features/admin/domain/roles/roleCatalog.ts`

- **`ejecutivo_pricing`**: "Negocia y mantiene tarifas con partners (navieras, agentes, transportistas). Trabaja el módulo de Costeo y propone overrides; el Gerente Comercial los aprueba."
- **`vendedor`**: "Arma cotizaciones con costos y P&L preliminar de sus cuentas, ve sus márgenes y hace handoff al Coordinador Logístico al confirmarse. Trabaja CRM (leads, oportunidades, actividades) y ve embarques y cobranza de sus cuentas."

---

## 4) Filtros existentes que ya quedan bien

- `VendedorSelect.tsx` y `Oportunidades.tsx` ya incluyen `vendedor` — no cambia.
- `dashboard/hooks/useDashboardController.ts:35` (`role === "vendedor"` para `showScopeToggle`) sigue funcionando.
- `lib/auth/roleHierarchy.ts` — sin cambios: pricing sigue satisfaciendo `operador` (necesario para Costeo).

---

## 5) Versionado

- Bump `APP_VERSION` → `13.118.0` (cambio de capacidades visibles, minor).
- Entrada en `CHANGELOG.md` con resumen breve y analogía cocina/caja.

## 6) Pruebas

- `src/hooks/__tests__/usePermissions.test.tsx` — agregar 2 casos:
  - `vendedor` ahora tiene `canEditOperations === true` y `canViewFinancials === true`.
  - `ejecutivo_pricing` mantiene `canEditOperations === true` y `canViewFinancials === true`.
- `src/features/admin/domain/roles/__tests__/roleCatalog.test.ts` — actualizar el snapshot/string de descripción si el test compara strings exactos (revisar; si sólo verifica presencia de la key, no toca nada).

**Sin migraciones de BD.** El enum `app_role` ya soporta ambos roles. Las RLS que filtran por owner siguen como están.
