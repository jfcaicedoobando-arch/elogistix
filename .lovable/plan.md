## Problema

Cuando el sidebar está colapsado (modo `icon`), la rueda del mouse no hace scroll vertical sobre la lista de íconos. Causa raíz: en `src/components/ui/sidebar.tsx` línea 334, el `SidebarContent` aplica `group-data-[collapsible=icon]:overflow-hidden`, lo cual desactiva el scroll cuando hay más íconos de los que caben en pantalla. Por eso "no se ven todos los iconos" — sí se renderizan, pero quedan recortados sin poder hacer scroll hacia ellos.

Analogía: es como una lista en una caja con tapa. En modo expandido la tapa tiene una rendija (`overflow-y-auto`) por la que puedes deslizar el contenido; en modo colapsado le pusieron tapa sellada (`overflow-hidden`) y los íconos de abajo quedan atrapados.

## Cambios

1. **`src/components/ui/sidebar.tsx`** (línea 334)
   - Quitar `group-data-[collapsible=icon]:overflow-hidden` para que `overflow-y-auto` aplique tanto expandido como colapsado.
   - Mantener `overflow-x-hidden` para que el tooltip/desbordamiento horizontal no aparezca.

2. **Verificación visual**
   - Abrir `/embarques/...` con sidebar colapsado y confirmar (vía Playwright + screenshot) que:
     - La rueda del mouse mueve la lista de íconos.
     - Todos los íconos de las secciones (Operación, Catálogos, Configuración, etc.) son alcanzables.

3. **Versionado y changelog**
   - `src/constants/appVersion.ts` → `13.104.1` (patch: bug UI).
   - `CHANGELOG.md` → entrada `[13.104.1]` con un bullet describiendo el fix.

## Fuera de alcance

- No cambio el diseño del sidebar, ni los íconos, ni la lógica de secciones.
- No toco `OrgSwitcher`, `SidebarUserMenu` ni `SidebarGroupBlock`.
