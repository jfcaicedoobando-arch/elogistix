## Sidebar Etapa 2 — Reorganización por flujo del dinero

Aplicar el documento `instrucciones-lovable-sidebar-etapa2-2026-07-25.md` tal cual. Se toca **solo** menú (no rutas, guards ni BD).

### Alcance
- Reagrupar el menú por: **Inicio · Operación · Ventas (CxC) · Compras (CxP) · Dinero · Costeo · Análisis · Sistema**.
- Analogía: es como reordenar los cajones de una alacena; la comida (rutas, permisos, badges) sigue exactamente donde estaba, solo cambia en qué cajón se guarda.

### Cambios
1. **`src/components/layout/sidebarItems.ts`**
   - Eliminar: `SIDEBAR_GESTION_ITEMS`, `SIDEBAR_DIRECTORIO_ITEMS`, `SIDEBAR_PROFIT_ITEMS`, `SIDEBAR_REPORTES_ITEMS`.
   - Crear: `SIDEBAR_VENTAS_ITEMS`, `SIDEBAR_OPERACION_ITEMS`, `SIDEBAR_DINERO_ITEMS`, `SIDEBAR_ANALISIS_ITEMS` (según §Paso 1).
   - Conservar: `SIDEBAR_DASHBOARD_ITEMS`, `SIDEBAR_COMPRAS_ITEMS`, `SIDEBAR_COSTEO_ITEMS`, `SIDEBAR_CRM_ITEMS`, `SIDEBAR_SISTEMA_ITEMS`, `SIDEBAR_ADMIN_ITEMS`, `SIDEBAR_SUPER_ADMIN_ITEMS`.

2. **`src/hooks/layout/sidebarRoleBuilders.ts`**
   - Reemplazar helpers `filterGestion`/`filterDirectorio` por `filterVentas` / `filterOperacion` / `filterDinero` / `filterAnalisis`.
   - Reescribir los 11 builders (vendedor, customer_service, coordinador, ejecutivo_pricing, contador, tesorero, auxiliar_contable, ejecutivo_cobranza, gerente_comercial, gerente_operaciones, admin) y `buildDefaultSections` con la agrupación de §Paso 2.
   - `ROLE_BUILDERS` y el mapa rol→builder no se tocan.

3. **Tests**
   - Actualizar `src/hooks/layout/__tests__/useLayout.test.tsx` con las nuevas etiquetas por rol. Los asserts de URLs no cambian.
   - Buscar referencias residuales a las 4 constantes eliminadas y apuntarlas a las nuevas.

### Validaciones no negociables
Antes de bumpear versión:
- **Set de URLs por rol idéntico** al de v13.317.10 (misma comida, distinto cajón). Comparo la salida de cada builder antes/después para cada uno de los 13 roles.
- Badges siguen renderizando (embarques, facturación vencidas, CxP por-aprobar/por-pagar, CRM, auditoría) — viven en `useAppSidebarSections` por URL.
- `bun run lint`, tests de layout y `agregador.fuente.test.ts` (que no debe romperse) verdes.
- `gerente_operaciones` explícitamente gana visibilidad de las 4 subrutas de Dinero: Pagos programados, Conciliación bancaria, Cuentas bancarias, Flujo — su guard `TESORERIA_READ_ROLES` ya se los permite.

### Post-implementación
- Bump `APP_VERSION` → `13.318.0` (cambio menor de UX estructural, no breaking).
- Entrada en `CHANGELOG.md` con la lista de secciones por rol.

### Riesgo
Bajo. Rollback = revert de un solo PR sin efectos colaterales (no hay migraciones ni cambios de datos).
