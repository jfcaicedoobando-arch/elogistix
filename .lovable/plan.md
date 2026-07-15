## Objetivo

Eliminar la redundancia entre el sidebar (que hoy lista 4 rutas de Profit) y la `ProfitSubNav` (Fase 4, que repite esas 4 rutas arriba en cada página). Adoptamos el patrón **hub + tabs**: un solo enlace "Profit" en el sidebar; la navegación entre las 4 pestañas vive dentro del módulo.

## Cambios

### 1. `src/components/layout/sidebarItems.ts`
Reemplazar `SIDEBAR_PROFIT_ITEMS` (4 rutas) por un array con un único item:

```ts
export const SIDEBAR_PROFIT_ITEMS: SidebarItem[] = [
  { title: "Profit", url: "/profit/dashboard", icon: TrendingUp },
];
```

- Mantener el nombre exportado para no tocar los 8 usos en `sidebarRoleBuilders.ts`.
- `url` apunta a `/profit/dashboard` (hub natural: Dashboard Ejecutivo).
- Icono `TrendingUp` (representa el módulo global mejor que `LayoutDashboard`, que ya usa "Principal").
- Limpiar imports huérfanos (`LayoutDashboard`, `PiggyBank`, `BarChart3` sólo si dejan de usarse en otros grupos — verificar antes de borrar).

### 2. Activación del enlace
Con `NavLink` y `end` implícito, `/profit/dashboard` sólo se marcaría activo en esa ruta. Necesitamos que "Profit" se vea activo en cualquier `/profit/*`. Opciones:
- Si el `SidebarGroupBlock` usa `isActive` custom por `pathname.startsWith(item.url.split('/').slice(0,2).join('/'))`, ya funciona.
- Si no, agregar un flag opcional `matchPrefix?: string` en `SidebarItem` y pasar `"/profit"`.

Confirmaré leyendo `SidebarGroupBlock` antes de decidir la variante mínima.

### 3. `ProfitSubNav`
Sin cambios. Sigue siendo la navegación primaria dentro del módulo. Ya está integrada en las 4 rutas y con tests verdes.

### 4. Tests
- Actualizar cualquier test que aserte los 4 items de Profit en el sidebar (buscaré `SIDEBAR_PROFIT_ITEMS` y "Dashboard Ejecutivo" en `__tests__/`).
- Agregar un test corto: el sidebar renderiza un único item "Profit" y su enlace apunta a `/profit/dashboard`.
- Agregar un test que confirme que estando en `/profit/proyeccion`, el item "Profit" del sidebar aparece con estilo activo (si la lógica de prefijo lo requiere).

### 5. Versionado
- `APP_VERSION` → `13.300.47`.
- Entrada en `CHANGELOG.md` describiendo la consolidación (patrón hub + tabs, cero cambio de rutas).

## Fuera de alcance
- No se tocan rutas, permisos, ni la lógica de Profit.
- No se modifica `ProfitSubNav` ni sus tests.
- No se cambian otros grupos del sidebar.
