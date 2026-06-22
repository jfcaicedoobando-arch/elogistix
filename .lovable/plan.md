# Fase A — Coherencia del módulo de Compras

Lo ya entregado en quick wins queda fuera: UI unificada de Por capturar (✅) y validación de duplicados (✅). Esto cubre los 2 ítems restantes de la Fase A.

---

## 1. Hub de Compras (`/compras`)

Nueva ruta pública dentro del módulo. **No duplica páginas**: actúa como landing + barra de pestañas que navega a las rutas existentes.

### 1a. Página `Compras.tsx` (Resumen)
- `PageHeader` con icono `ShoppingCart`, título "Compras", descripción "Gestión de proveedores, facturas y pagos".
- **Tab strip** (NavLink horizontal) visible en todas las sub-rutas del módulo:
  - Resumen → `/compras`
  - Proveedores → `/proveedores`
  - Por capturar → `/cxp/por-capturar`
  - Facturas → `/cxp`
  - Por pagar → `/cxp/por-pagar`
- **KPIs cruzados** del módulo (4 cards):
  - Proveedores activos (count en `proveedores` no borrados)
  - Embarques por capturar (count de `cxp_por_capturar` RPC)
  - Facturas por pagar (count + total MXN homologado)
  - Vencido total (count + MXN/USD)
- **Tarjetas de acceso rápido** (1 por submódulo) con: icono + título + 1 KPI + CTA "Ir a…".
- **Atajos** sección con botones: "Capturar factura" (abre `DialogNuevaFacturaProveedor`), "Nuevo proveedor", "Importar CSV proveedores".

### 1b. Componente `ComprasTabStrip`
Tira de NavLinks reutilizable que **se inyecta arriba** en cada página del módulo (Compras, Proveedores, CxP, CxpPorCapturar, CxpPorPagar) para que el usuario siempre vea las 5 pestañas y sepa que está en el mismo módulo. Implementación: componente shared con `useLocation` para marcar la activa.

### 1c. Sidebar reorganizado
- Nuevo grupo **"Compras"** con: Resumen, Proveedores, Por capturar, Facturas, Por pagar.
- Quitar "Proveedores" de `SIDEBAR_DIRECTORIO_ITEMS` (Directorio queda solo con Clientes).
- Quitar "Facturas de proveedor" de `SIDEBAR_GESTION_ITEMS`.
- Quitar "Por capturar" y "Por pagar" de `SIDEBAR_BANDEJAS_ITEMS` (Bandejas queda con Por emitir y Cartera).
- Actualizar `sidebarRoleBuilders.ts` para incluir el nuevo grupo Compras según el rol (mismos permisos que cada item original).

### 1d. Routing
- `/compras` → `Compras.tsx` (lazy)
- Permisos: mismos que `/cxp` (tesorero, contador, admin_org, admin, super_admin, auxiliar_contable).

---

## 2. Búsqueda global de facturas de proveedor

### 2a. Extender RPC `busqueda_global`
Migración: agregar un `UNION ALL` más al `busqueda_global` para incluir `proveedor_facturas`:
- Busca por `folio_proveedor`, `proveedor_nombre`, o RFC del proveedor (join a `proveedores`).
- Tipo: `factura_proveedor`.
- URL: `/cxp?factura={id}` (la página CxP abrirá el detalle si recibe ese param).
- Excluye canceladas y borradas, scope por organization_id.

### 2b. `GlobalSearch.tsx`
- Agregar `factura_proveedor` a `typeIcons` (icono `Receipt`) y `typeLabels` ("Facturas de proveedor").
- Tipo `GlobalSearchResult["type"]` en `src/types/search.ts` debe incluir `"factura_proveedor"`.

### 2c. `Cxp.tsx` lee `?factura={id}`
- `useSearchParams`: si llega `factura`, busca la factura en `data` y abre `DialogDetallePagosProveedor`.

---

## Detalles técnicos

**Archivos a crear**
- `src/features/cxp/routes/Compras.tsx` (hub, ≤200 líneas)
- `src/features/cxp/components/ComprasTabStrip.tsx` (tira de pestañas, ~60 líneas)
- `src/features/cxp/components/ComprasResumenKpis.tsx` (4 KPI cards, ~80 líneas)
- `src/features/cxp/components/ComprasQuickActions.tsx` (atajos, ~60 líneas)
- Hook `useComprasResumen.ts` (agrega counts de las 3 fuentes)
- Migración SQL: `CREATE OR REPLACE FUNCTION busqueda_global` con el UNION extra

**Archivos a editar**
- `src/routes/appRoutes.tsx` + `appRoutes.lazy.ts` (registrar `/compras`)
- `src/routes/__tests__/appRoutes.smoke.test.tsx` (agregar ruta + roles)
- `src/components/layout/sidebarItems.ts` (nuevo `SIDEBAR_COMPRAS_ITEMS`)
- `src/hooks/layout/sidebarRoleBuilders.ts` (insertar grupo Compras en cada rol)
- `src/components/shared/GlobalSearch.tsx` (icono/label del nuevo tipo)
- `src/types/search.ts` (tipo `factura_proveedor`)
- `src/features/cxp/routes/Cxp.tsx` (leer `?factura=`)
- `src/features/cxp/routes/Cxp.tsx`, `CxpPorCapturar.tsx`, `CxpPorPagar.tsx`, `proveedor/routes/Proveedores.tsx` (inyectar `<ComprasTabStrip />` debajo del PageHeader)
- `CHANGELOG.md` + `appVersion.ts` (bump a `13.100.0`, salto menor por el hub nuevo)

**Backend**
- 1 migración: redefinición de `busqueda_global` (es SECURITY DEFINER, mantiene firma).

**Riesgos / qué evitar**
- No romper deep-links existentes (`/cxp`, `/cxp/por-capturar`, `/proveedores`, etc.). Todas siguen funcionando.
- Sidebar: validar que `sidebarRoleBuilders` siga filtrando por permisos para cada rol.
- Búsqueda global: la RPC ya es `SECURITY DEFINER` con filtro `current_user_org_id()`; el UNION nuevo debe respetar el mismo patrón.

---

## Lo que NO entra en esta fase
- Orden de Compra (explícitamente excluida).
- Aprobación de facturas, aging extra, notas de crédito UI, propuesta de pago, conciliación bancaria → Fase B/C.
- DIOT, complemento de pago, validación 69-B → Fase D.

**Entregable**: módulo de Compras que el usuario percibe como una unidad coherente y donde puede buscar cualquier factura de proveedor por folio o RFC desde Ctrl+K.
