## Objetivo

Hacer que el header del sidebar y el header de la página tengan **exactamente la misma altura (h-16 = 64px)** para lograr simetría visual perfecta en la línea horizontal superior donde se encuentran ambos.

## Estado actual

- **Topbar de página** (`Layout.tsx`): `h-16` fijo (64px), con `border-b`.
- **SidebarHeader** (`AppSidebar.tsx`): altura libre con `p-4` + logo `h-9 w-9` ≈ 68px, lo que rompe la alineación de la línea inferior con el topbar.

Resultado: el borde inferior del SidebarHeader queda ~4px por debajo del borde inferior del topbar, generando un escalón visible.

## Cambios propuestos

### 1. `src/components/layout/AppSidebar.tsx` — `SidebarHeader`
- Forzar altura fija `h-16` para igualar al topbar.
- Cambiar `p-4` a padding horizontal solamente (`px-4`) y centrar verticalmente con `flex items-center`, eliminando el padding vertical que descuadra.
- En modo colapsado mantener `px-2` y centrado.
- Reducir el logo de `h-9 w-9` a `h-8 w-8` para que respire mejor dentro de los 64px (padding visual ~16px arriba/abajo).
- Mantener `border-b border-sidebar-border` para que la línea coincida visualmente con la del topbar.

```tsx
<SidebarHeader className="h-16 border-b border-sidebar-border flex items-center px-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
  <div className={cn("flex items-center gap-3 w-full", collapsed && "justify-center gap-0")}>
    <img ... className="h-8 w-8 rounded-lg ..." />
    {!collapsed && ( ... )}
  </div>
</SidebarHeader>
```

### 2. (Opcional) Verificar `Layout.tsx`
No requiere cambios; ya está en `h-16`. Solo confirmar que el `border-b` de ambos headers use el mismo tono visual (ya es el caso: `border` del topbar y `border-sidebar-border` del sidebar son consistentes con el tema).

### 3. Changelog
Agregar entrada **v8.99.36** en `src/content/changelog/v8/chunks/0.ts` y actualizar `src/content/changelogData.ts`:
- Título: "Simetría header sidebar y topbar"
- Tipo: `improvement`
- Descripción: "Se alinea la altura del header del menú lateral (64px) con la barra superior de la página para una línea horizontal continua y simétrica."

## Resultado esperado

Una línea horizontal inferior **continua y perfectamente alineada** entre el `SidebarHeader` y el topbar de la página, tanto en modo expandido como colapsado, en claro y oscuro.
