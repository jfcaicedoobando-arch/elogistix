
# Auditoría y limpieza del Super Admin

## Problemas detectados

1. **"Usuarios Globales" es un concepto que no corresponde al modelo.** Los usuarios viven dentro de una organización (`organization_members`). La pantalla actual sólo aplana la lista y duplica lo que ya vive en el detalle de cada organización (pestaña Miembros).
2. **KPIs engañosos en el Dashboard.** Las tarjetas de "Embarques" y "Cotizaciones" navegan a `/admin/organizaciones` sin filtro, dando una falsa sensación de que vas a ver esos datos.
3. **Sidebar plano sin jerarquía.** Mezcla operación diaria (Organizaciones), salud (Auditoría, Diagnóstico) y sistema (Configuración Global) al mismo nivel.

## Cambios propuestos

### 1. Eliminar el módulo `/admin/usuarios`

- Quitar la ruta `AdminUsuarios` de `src/routes/adminRoutes.tsx`.
- Quitar el item "Usuarios" del `AdminSidebar`.
- Quitar la tarjeta KPI "Usuarios" del `AdminDashboard` (o reemplazarla por una métrica útil — ver punto 2).
- Borrar archivos huérfanos: `AdminUsuarios.tsx`, `AdminUsuariosColumns.tsx`, `AdminUsuariosFilters.tsx`, `useAdminUsuariosController.ts` y su export en el barrel `features/admin/hooks`.
- **Conservar** `NuevoUsuarioDialog` y el servicio `fetchAvailableUsers` porque los sigue usando `AgregarMiembroOrgDialog` dentro del detalle de organización.
- La gestión de usuarios queda centralizada en `/admin/organizaciones/:id` → tarjeta `OrgMembersCard` (que ya permite agregar, cambiar rol y quitar miembros).

### 2. Simplificar el Dashboard Super Admin

- Dejar sólo dos KPIs accionables:
  - **Organizaciones totales** → navega a `/admin/organizaciones`.
  - **Miembros totales en la plataforma** (suma de `organization_members`) → no navega; es informativo.
- Eliminar tarjetas de "Embarques" y "Cotizaciones" (no aportaban porque no llevaban a ninguna vista filtrada).
- Mantener la gráfica de actividad por organización y la lista de "Últimas organizaciones" (esas sí son accionables).

### 3. Reorganizar el sidebar en 2 grupos

```text
Plataforma
  • Dashboard            /admin
  • Organizaciones       /admin/organizaciones
  • Auditoría plataforma /admin/auditoria
  • Diagnóstico          /admin/diagnostico

Sistema
  • Configuración Global /admin/configuracion
```

Implementación: usar `SidebarGroupLabel` por grupo dentro del `AdminSidebar` actual, sin tocar el `SidebarFooter` (menú de usuario).

### 4. Changelog y versión

- Bump `APP_VERSION` (patch o minor según corresponda).
- Entrada en `CHANGELOG.md` describiendo: eliminación de Usuarios Globales, simplificación de KPIs y reagrupación del sidebar.

## Detalles técnicos

- **Ruta eliminada**: `<Route path="/admin/usuarios" .../>` en `adminRoutes.tsx`. No hay enlaces internos hacia ella fuera del sidebar y el dashboard, así que no quedan referencias rotas (a verificar con `rg "/admin/usuarios"`).
- **Hook nuevo opcional**: `useAdminTotalMembers` — un `count` sobre `organization_members` para alimentar el KPI nuevo. Puede ir como campo extra dentro de `useAdminDashboardStats` para no agregar otra query.
- **Tests**: revisar `src/__tests__/architecture/*` y `routes.smoke.test.tsx` por referencias a `AdminUsuarios`.
- **Memory**: actualizar `mem://index.md` si hay alguna entrada que mencione "Usuarios Globales" (no detecté ninguna, pero confirmamos al implementar).

## Fuera de alcance

- No tocar lógica de roles ni RLS.
- No rediseñar visualmente las tarjetas ni cambiar el design system.
- No crear vistas globales de embarques/cotizaciones cruzando organizaciones (queda como backlog futuro si lo necesitas).
