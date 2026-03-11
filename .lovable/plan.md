

## Plan: Sección colapsable "Dashboards" + quitar Reportes + página Operaciones

### Archivos a modificar

**1. `src/components/AppSidebar.tsx`**
- Importar `Activity`, `ChevronDown` de lucide-react; quitar `BarChart3`
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible`
- Importar `Separator` de `@/components/ui/separator`
- Crear array `dashboardItems` con Principal (`/`, LayoutDashboard) y Operaciones (`/operaciones`, Activity)
- Quitar "Dashboard" y "Reportes" del array `menuItems`
- En el render, antes del SidebarGroup principal:
  - Si collapsed: renderizar los dashboardItems como items normales (solo íconos)
  - Si expandido: renderizar un `Collapsible` con `defaultOpen={true}`, trigger "Dashboards" con chevron rotable, y contenido con sub-items indentados con borde izquierdo (`border-l-2 ml-4 pl-2`)
- Agregar `<Separator />` entre la sección Dashboards y el menú principal

**2. `src/App.tsx`**
- Agregar lazy import: `const Operaciones = lazy(() => import("./pages/Operaciones"))`
- Agregar ruta: `<Route path="/operaciones" element={<Operaciones />} />` junto a la ruta `/`
- Mantener ruta `/reportes` (el archivo no se elimina)

**3. `src/pages/Operaciones.tsx`** (crear)
- Página placeholder con título "Dashboard de Operaciones", subtítulo "Rendimiento del equipo operativo", y card con texto "Próximamente"
- Seguir el mismo patrón de layout que las otras páginas (div con padding, heading, etc.)

