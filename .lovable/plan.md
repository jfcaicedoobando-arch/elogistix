

## Plan: Cambiar sección Dashboards a estática

La sección "Dashboards" actualmente usa un `Collapsible` con chevron, a diferencia del resto de secciones que son estáticas. El cambio es simple: reemplazar el `Collapsible` por un `SidebarGroup` con label estático, igual que la sección principal.

### Cambios en `src/components/AppSidebar.tsx`

**1. Eliminar el Collapsible y la bifurcación collapsed/expanded (líneas 88-146)**

Reemplazar todo ese bloque por un `SidebarGroup` simple que renderice los `dashboardItems` de la misma forma que el menú principal (líneas 150-175). El label "Dashboards" se mantiene como `text-xs uppercase` pero sin chevron ni toggle.

**2. Limpiar imports no usados**

Eliminar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` y `ChevronDown` ya que no se usan en ningún otro lugar del componente.

### Resultado

```text
┌─────────────────────┐
│   DASHBOARDS         │  ← label estático, sin chevron
│   Principal          │
│   Operaciones        │
├─────────────────────┤
│   Cotizaciones       │
│   Embarques          │
│   ...                │
└─────────────────────┘
```

### Archivo modificado
- `src/components/AppSidebar.tsx`

