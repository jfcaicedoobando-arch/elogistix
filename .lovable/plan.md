## Problema

El sidebar muestra un badge rojo en **"Principal"** con el total agregado de 4 categorías de alertas (`totalAlertas = embarquesDemora + facturasVencidas + garantiasAtoradas + adminPendientes` → 19), pero la página `/inicio` sólo muestra los embarques en demora (3). El usuario lee 19 en el sidebar y espera ver 19 en el dashboard.

## Solución: desglosar el badge por módulo

Quitar el badge agregado de **"Principal"** y exponer cada categoría como un badge sobre el ítem del sidebar al que pertenece, igual que ya se hace con `/embarques` (admin pendientes), `/auditoria` y `/crm`. Cada número en el sidebar coincidirá con el módulo donde se ve el detalle.

### Mapeo

| Categoría | Origen actual | Ítem del sidebar |
|---|---|---|
| `embarquesDemora` | `fetchSidebarAlertCounts` | `/embarques` (se **suma** al badge actual de adminPendientes) |
| `facturasVencidas` | `fetchSidebarAlertCounts` | `/facturacion` |
| `garantiasAtoradas` | `fetchSidebarAlertCounts` | `/embarques` (también vinculado a embarques) — alternativa: `/cxp` |
| `adminPendientes` | `fetchAdminPendientesCount` | `/embarques` (ya existente) |
| **Principal** (`/`) | — | **sin badge** |

`embarquesDemora`, `garantiasAtoradas` y `adminPendientes` se acumulan todos sobre `/embarques` (los tres son alertas del ciclo de embarque). `facturasVencidas` se va a `/facturacion`.

### Archivos a tocar

1. **`src/components/layout/SidebarGroupBlock.tsx`** (líneas 60-65)
   - Eliminar el fallback `item.url === "/" ? totalAlertas : 0`. El badge sólo se mostrará cuando el ítem tenga `badgeCount` explícito.
   - Quitar la prop `totalAlertas` (ya no se usa).

2. **`src/components/layout/AppSidebar.tsx`**
   - Quitar el paso de `totalAlertas` a `SidebarGroupBlock` y la lectura de `useSidebarAlerts()` (a menos que se use en otro lado — verificar).

3. **`src/hooks/layout/useAppSidebarSections.ts`**
   - Renombrar `patchEmbarquesBadge` a `patchSidebarBadges`.
   - El nuevo `patchSidebarBadges` recibe `{ embarquesAlertas, facturasVencidas }` y aplica:
     - `/embarques` → `embarquesAlertas` (suma de `embarquesDemora + garantiasAtoradas + adminPendientes`)
     - `/facturacion` → `facturasVencidas`
   - Leer las 4 piezas de `useSidebarAlerts()` y construir `embarquesAlertas` antes de invocarlo.

4. **`src/hooks/layout/__tests__/useLayout.test.tsx`** — actualizar el mock de `useSidebarAlerts` si valida el badge.

5. **`src/constants/appVersion.ts`** → `13.98.4`.
6. **`CHANGELOG.md`** → entrada `[13.98.4]` describiendo el cambio.

### Verificación

- `bunx vitest run` (todos).
- Visual en `/inicio`: el ítem **Principal** ya no muestra badge; **Embarques** muestra la suma 3 + demoras + garantías; **Facturación** muestra el conteo de facturas vencidas.

### Lo que NO cambia

- Las queries de Supabase (`fetchSidebarAlertCounts`, `fetchAdminPendientesCount`) intactas.
- Lógica de las páginas `/inicio`, `/embarques`, `/facturacion` intactas.
- Permisos y rutas intactos.
