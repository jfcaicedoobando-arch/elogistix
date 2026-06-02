## Objetivo

Limitar el sidebar del rol `operador` a su trabajo diario, ocultando módulos financieros, de análisis y técnicos.

## Visibilidad por sección (rol operador)

**Visible**
- Dashboards: Principal, Operaciones
- Gestión: Cotizaciones, Embarques, Pre-Facturación
- Directorio: Clientes, Proveedores
- Sistema: Ayuda

**Oculto**
- Gestión: Cuentas por Pagar, Tesorería, Comisiones
- Profit (sección completa)
- CRM (sección completa)
- Reportes (sección completa)
- Sistema: Auditoría, Bitácora, Sentry
- Administración y Super Admin (ya estaban ocultos)

Admin, super_admin y vendedor mantienen su comportamiento actual sin cambios.

## Cambios técnicos

Archivo: `src/hooks/layout/useAppSidebarSections.ts`

1. Añadir rama específica para `effectiveRole === "operador"` (antes del bloque genérico), retornando sólo:
   - Dashboards: `SIDEBAR_DASHBOARD_ITEMS` completo
   - Gestión: filtrar a `/cotizaciones`, `/embarques`, `/facturacion`
   - Directorio: `SIDEBAR_DIRECTORIO_ITEMS` completo
   - Sistema: filtrar a `/ayuda`
2. No tocar items globales (`sidebarItems.ts`) para no afectar a otros roles.
3. No tocar rutas ni guardas; sólo es ocultamiento visual en el sidebar (las rutas siguen accesibles por URL para no romper permisos existentes — si más adelante se quiere bloquear acceso por ruta, se hace en una iteración aparte).

## Versionado

- Bump `APP_VERSION` a la siguiente patch (12.49.4).
- Entrada en `CHANGELOG.md` (root): "Sidebar del rol operador limitado a operación diaria (oculta Profit, CRM, Reportes, CxP, Tesorería, Comisiones, Auditoría, Bitácora, Sentry)."

## Validación

- Login como Alan Hernández (operador) → confirmar secciones visibles.
- Login como admin → sidebar sin cambios.
- Login como vendedor → sin cambios (rama existente).
