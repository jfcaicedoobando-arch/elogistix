## Diagnóstico

En móvil, el sidebar se renderiza como `Sheet` (overlay) de Radix vía shadcn `Sidebar`. Al hacer click sobre un `NavLink` dentro de `SidebarGroupBlock`, react-router cambia la ruta pero **nadie llama a `setOpenMobile(false)`**, por lo que el Sheet se queda abierto encima del contenido. El usuario debe cerrarlo manualmente (tap fuera o botón X).

Hallazgos del audit:

1. **`SidebarGroupBlock.tsx`** — los `NavLink` no cierran el sidebar móvil al navegar. Causa raíz del bug reportado.
2. **`AppSidebar.tsx`** — no propaga el handler de cierre; no usa `useSidebar().setOpenMobile`.
3. **`SidebarUserMenu.tsx`** — "Cerrar sesión" y toggle de tema tampoco cierran el sheet móvil (menor, pero misma clase de bug).
4. **`OrgSwitcher`** (renderizado dentro del sidebar) — revisar si tras cambiar de organización deja el sheet abierto.
5. La opción nativa de shadcn `SidebarMenuButton` no auto-cierra en móvil; es responsabilidad del consumidor.

## Cambios propuestos

1. **`SidebarGroupBlock.tsx`**
   - Consumir `useSidebar()` y obtener `isMobile`, `setOpenMobile`.
   - En el `NavLink`, agregar `onClick={() => { if (isMobile) setOpenMobile(false); }}`.

2. **`SidebarUserMenu.tsx`**
   - Aceptar opcional `onAfterAction?: () => void` desde `AppSidebar` (que pasará `() => setOpenMobile(false)` cuando `isMobile`).
   - Llamarlo dentro de `onSignOut` y `onToggleTheme` envueltos.

3. **`AppSidebar.tsx`**
   - Leer `setOpenMobile` y `isMobile` de `useSidebar()` (ya usa `useSidebar`).
   - Pasar el callback de cierre al `SidebarUserMenu`.

4. **`OrgSwitcher`** — revisar y, si aplica, cerrar el sheet móvil tras seleccionar org.

5. **Verificación visual** con Playwright en viewport móvil (375×812): abrir sidebar, click en "Embarques", confirmar navegación + sheet cerrado por screenshot.

6. **Changelog + APP_VERSION** bump siguiendo la convención del proyecto.

## Fuera de alcance

- No se toca el comportamiento desktop (sidebar tipo `collapsible="icon"` no se ve afectado: `isMobile` es `false`).
- No se modifican rutas ni lógica de permisos.
