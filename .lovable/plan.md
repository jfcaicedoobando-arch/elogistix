## Problema

Cuando el sidebar está colapsado, los tooltips de los items (Embarques, Cotizaciones, etc.) se renderizan justo encima del contenido de la página (cards del dashboard). El tooltip usa `bg-popover` blanco sobre cards también blancas, sin sombra fuerte, y al ser angosto, el texto de la card que queda a su derecha (ej. "Confirmado") parece "atravesarlo", dando la sensación de texto ilegible/encimado.

## Solución (solo UI)

Reforzar visualmente el tooltip del sidebar colapsado para que quede claramente por encima del contenido:

1. **`src/components/layout/SidebarGroupBlock.tsx`** — al pasar la prop `tooltip` al `SidebarMenuButton`, en lugar de un string usar un objeto:
   ```ts
   tooltip={{
     children: item.title,
     className: "bg-sidebar text-sidebar-foreground border-sidebar-border shadow-xl font-medium",
     sideOffset: 8,
   }}
   ```
   - Fondo oscuro (token `--sidebar`) que contrasta contra el contenido claro de las páginas.
   - Borde con `--sidebar-border` y `shadow-xl` para separación visual clara.
   - `sideOffset: 8` para alejarlo un poco más del icono.

2. **Verificar** con screenshot del preview con el sidebar colapsado, hoveando "Embarques" y "Cotizaciones", que el tooltip se lea sin mezclarse con el contenido de fondo.

## Versionado

- `APP_VERSION` → **8.152.4** (patch, fix visual).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Archivos a tocar

- `src/components/layout/SidebarGroupBlock.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`

Sin cambios en lógica, RPC, ni en el componente shadcn `sidebar.tsx` (que sigue aceptando el objeto tal cual).