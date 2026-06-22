# Auditoría de permisos: Gerente Comercial / Gerente de Operaciones

## Hallazgos

Comparé el catálogo de roles (`roleCatalog.ts`), la matriz `usePermissions`, el sidebar (`sidebarRoleBuilders.ts`) y los guards de ruta (`appRoutes.tsx`). Hay **desalineación entre lo que el sidebar muestra y lo que las rutas permiten** — los gerentes ven entradas en el menú que, al hacer clic, los redirigen a `/` por `ProtectedRoute`.

### Gerente de Operaciones (descripción: "Supervisa la operación diaria. Lee finanzas y aprueba")

Sidebar muestra estos items, pero las rutas los bloquean:

| Item del sidebar | Ruta | Roles permitidos hoy | Resultado |
|---|---|---|---|
| Facturas de proveedor | `/cxp` | admin, super_admin, contador, tesorero, auxiliar_contable | Redirige |
| Tesorería | `/tesoreria` y `/tesoreria/*` | admin, super_admin, contador, tesorero | Redirige |
| Cobranza | `/cartera` | admin, super_admin, admin_org, contador, ejecutivo_cobranza | Redirige |
| Profit › Dashboard Ejecutivo | `/profit/dashboard` | TESORERIA_ROLES | Redirige |
| Profit › Presupuesto | `/profit/presupuesto` | TESORERIA_ROLES | Redirige |

### Gerente Comercial (descripción: "Ve CRM completo, cotizaciones con márgenes, clientes y comisiones; sin tesorería")

| Item del sidebar | Ruta | Estado |
|---|---|---|
| Profit › Dashboard Ejecutivo | `/profit/dashboard` | Bloqueado |
| Profit › Presupuesto | `/profit/presupuesto` | Bloqueado |

El resto (Cotizaciones, Embarques, Comisiones, Costeo, Reportes, Directorio, Estado de Resultados, Proyección) sí funciona.

### Lo que sí está bien

- `usePermissions` ya incluye ambos roles en `FINANCE_VIEWERS`, `OPERATIONS` (operaciones) y `SALES`/`OVERRIDE_TARIFA_PRICING` (comercial). El catálogo y la jerarquía (`roleHierarchy.ts`) son consistentes.
- Sidebar no muestra Administración/Configuración/Usuarios (correcto).
- Gerente Comercial no ve Tesorería en sidebar (correcto).

## Cambios propuestos (solo `appRoutes.tsx`)

Analogía: la sidebar es el menú del restaurante y las rutas son las puertas a la cocina. Hoy el menú ofrece platillos cuyas puertas están cerradas para estos dos gerentes — hay que abrirles las puertas de **lectura** que su rol justifica.

1. **Definir un guard reutilizable** `FINANCE_READ_ROLES` que incluya: `admin`, `super_admin`, `admin_org`, `contador`, `tesorero`, `auxiliar_contable`, `ejecutivo_cobranza`, `gerente_operaciones`, `gerente_visor`. (Refleja `FINANCE_VIEWERS` de `usePermissions`.)

2. **Agregar `gerente_operaciones` (y `gerente_visor`) a las rutas de lectura financiera**:
   - `/cxp`, `/compras`, `/compras/aging`, `/cxp/por-capturar`, `/cxp/por-pagar`
   - `/tesoreria`, `/tesoreria/cuentas`, `/tesoreria/conciliacion`, `/tesoreria/flujo`
   - `/cartera`, `/facturacion/por-emitir`
   - `/profit/dashboard`, `/profit/presupuesto`

3. **Agregar `gerente_comercial` a las rutas de Profit** (`/profit/dashboard`, `/profit/presupuesto`) ya que el sidebar lo expone y la descripción incluye "cotizaciones con márgenes".

4. **No tocar** la lógica de escritura: las mutaciones de tesorería/CXP siguen restringidas por `usePermissions` (`canEditFinance`, `canPagarProveedor`, etc.), donde estos gerentes no figuran.

5. **Sidebar**: no requiere cambios — ya refleja la intención del catálogo.

## Verificación

- Ajustar `src/routes/__tests__/appRoutes.smoke.test.tsx` para los nuevos `allowedRoles`.
- Ejecutar `bunx vitest run src/routes/__tests__/appRoutes.smoke.test.tsx src/hooks/layout/__tests__/useLayout.test.tsx src/lib/auth/__tests__/roleHierarchy.test.ts`.
- Smoke manual con Playwright opcional iniciando sesión como gerente_operaciones y navegando a `/tesoreria` y `/profit/dashboard` (debe renderizar, no redirigir).

## Versionado y changelog

- Bump `APP_VERSION` a `13.114.3`.
- Entrada en `CHANGELOG.md`: "Alinear permisos de Gerente Comercial y Gerente de Operaciones con el catálogo: lectura financiera (CXP, tesorería, cartera, profit) habilitada por ruta."

## Fuera de alcance

- Auditoría operativa (`/auditoria`) sigue restringida a admin; si quieres que los gerentes la vean en modo lectura, lo trato como cambio aparte.
- Permisos a nivel componente (botones de aprobar/pagar) no se modifican.
