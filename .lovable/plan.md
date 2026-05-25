
## Objetivo

El sidebar global tendrá **un único item "CRM"** que lleva a `/crm`. Una vez dentro, el módulo CRM presenta su propia navegación (tabs horizontales) con: Dashboard, Leads, Oportunidades, Actividades, Forecast, Reportes.

## Cambios

### 1. Sidebar global
- `src/components/layout/sidebarItems.ts`: reducir `SIDEBAR_CRM_ITEMS` a un solo item: `{ title: "CRM", url: "/crm", icon: Target }`.
- `src/hooks/layout/useAppSidebarSections.ts`: la sección "CRM" sigue existiendo pero con un solo enlace. Para el rol `vendedor`, igual — entran a `/crm` y de ahí navegan.

### 2. Layout interno del CRM
- Crear `src/pages/crm/CrmLayout.tsx`: contiene un header con el título "CRM" + tabs horizontales (usando `NavLink` o componente `Tabs` de shadcn estilo nav) para las 6 secciones, y `<Outlet />` debajo.
- Las tabs marcan la activa según `useLocation()`.

### 3. Rutas anidadas
- `src/App.tsx`: convertir las rutas CRM a un bloque anidado:
  ```
  <Route path="/crm" element={<CrmLayout />}>
    <Route index element={<CrmDashboard />} />
    <Route path="leads" element={<Leads />} />
    <Route path="leads/:id" element={<LeadDetalle />} />
    <Route path="oportunidades" element={<Oportunidades />} />
    <Route path="oportunidades/:id" element={<OportunidadDetalle />} />
    <Route path="actividades" element={<Actividades />} />
    <Route path="forecast" element={<Forecast />} />
    <Route path="reportes" element={<Reportes />} />
  </Route>
  ```
- Las páginas internas pierden cualquier título redundante (el layout ya lo da).

### 4. Versionado y changelog
- Bump `APP_VERSION` a `11.2.1` (patch UX).
- Entrada en `chunk0.ts` y `changelogData.ts` describiendo la reorganización.

## Notas

- Las páginas de detalle (`leads/:id`, `oportunidades/:id`) se montan dentro del layout: las tabs muestran la sección padre como activa.
- No se modifica lógica de datos, hooks, ni migraciones.
- Se respeta la regla de componentes ≤200 líneas: `CrmLayout` será un componente pequeño (~60 líneas).
