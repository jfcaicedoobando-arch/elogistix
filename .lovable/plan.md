# Plan: Sidebar — colapsar/expandir mejorado y fix scrollbar horizontal

## Diagnóstico

El sidebar ya tiene `collapsible="icon"`, tooltips configurados en `SidebarMenuButton tooltip={item.title}`, e indicador `isActive`. Lo que falta:

1. **Scrollbar horizontal indeseado**: `SidebarContent` usa `overflow-auto` (ambos ejes). Cuando algún hijo se desborda mínimamente (por ejemplo una org name larga, un email largo en el footer, o el badge de alertas que rompe `[&>span:last-child]:truncate`), aparece scrollbar horizontal feo en la parte inferior del sidebar.
2. **Indicador activo poco visible** en modo collapsed: el item activo cambia de fondo (`bg-sidebar-accent`) pero en collapsed (3rem de ancho) el cambio de color de fondo de un cuadrito de 32px se pierde visualmente — no hay un "rail" lateral que lo destaque.
3. **Footer en collapsed**: el badge del rol y el `v8.99.34` están ocultos correctamente cuando collapsed, pero el botón "Cerrar sesión" no tiene tooltip → en modo icon se ve sólo el icono LogOut sin etiqueta.
4. **SidebarTrigger sin atajo visible**: existe `Cmd/Ctrl+B` (definido en `sidebar.tsx`) pero el usuario no lo descubre — añadir tooltip al trigger.

## Cambios a implementar

### A. Fix scrollbar horizontal (la causa principal del problema)
- `src/components/ui/sidebar.tsx` línea 334: `overflow-auto` → `overflow-y-auto overflow-x-hidden` en `SidebarContent`. Esto elimina cualquier scrollbar horizontal del sidebar manteniendo el vertical cuando hay muchos grupos.

### B. AppSidebar — items con badge y truncate consistente
- Envolver `<span>{item.title}</span>` + `<Badge>` dentro de un wrapper `flex items-center gap-2 flex-1 min-w-0` con el span marcado `truncate flex-1` y el badge `shrink-0 ml-auto`. Así el texto largo trunca correctamente y el badge nunca empuja overflow.

### C. Indicador activo — "rail" lateral
- En `SidebarMenuButton` con `isActive`, añadir vía className condicional una pseudobarra `before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-sidebar-primary before:rounded-r-full` (4px de barra azul vertical pegada al borde izquierdo del item activo). Visible tanto en expanded como en collapsed → escaneabilidad inmediata. Requiere que el botón sea `relative`.

### D. Footer en collapsed — tooltip en logout
- Envolver el botón "Cerrar sesión" en `<Tooltip>` cuando `collapsed`, mostrando "Cerrar sesión" como tooltip lateral (side="right"), igual a como funcionan los items de menú.

### E. SidebarTrigger con atajo visible
- En `Layout.tsx`, envolver `<SidebarTrigger />` en `<Tooltip>` mostrando "Colapsar/expandir menú · ⌘B". El atajo ya está implementado en `sidebar.tsx`.

### F. Header del sidebar en collapsed — quitar gap visible
- El `SidebarHeader` con `flex items-center gap-3` deja un gap incluso cuando el texto está oculto, generando padding asimétrico en collapsed. Cambiar a `gap-3 group-data-[collapsible=icon]:gap-0` o equivalente.

## Archivos modificados

```text
src/components/ui/sidebar.tsx       → overflow-x-hidden en SidebarContent
src/components/layout/AppSidebar.tsx → wrapper truncate + rail activo + tooltip logout + header sin gap collapsed
src/components/layout/Layout.tsx    → tooltip en SidebarTrigger con atajo
src/content/changelogData.ts        → entrada v8.99.35
```

## Lo que NO cambia
- Estructura de grupos, rutas o iconos.
- Comportamiento de colapso (`collapsible="icon"`, persistencia en cookie).
- Badge de alertas, logo, OrgSwitcher, lista de items.

Cero cambios funcionales. `tsc --noEmit` debe pasar limpio.
