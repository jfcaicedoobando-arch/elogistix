
# Fase 2 cont. — D12: split de `routes.tsx`

## Estado actual

`src/routes.tsx` = 188 líneas. Concentra:
- 60 `lazy()` imports.
- 4 grupos de rutas con guardas distintas (public, portal, admin, app + CRM anidado).

Justo bajo el guardrail Power-of-10 (200). D14 ya frena cualquier crecimiento, pero el archivo es difícil de leer y mezcla responsabilidades.

## Estrategia

Dividir por **guarda + layout** (no por dominio), porque cada bloque comparte un `<Route element={<Guard><Layout/></Guard>}>` propio. CRM va dentro de `app.tsx` porque ya está anidado bajo `/crm` → `CrmLayout` dentro del `Layout` principal.

```
src/
├─ routes.tsx                  ← orchestrator (~30 líneas)
└─ routes/
   ├─ publicRoutes.tsx         ← login, tracking, redirects, 404 (~20 líneas)
   ├─ portalRoutes.tsx         ← /portal/* bajo PortalProtectedRoute + PortalLayout (~35 líneas)
   ├─ adminRoutes.tsx          ← /admin/* bajo super_admin guard (~30 líneas)
   └─ appRoutes.tsx            ← resto bajo ProtectedRoute + Layout, incl. /crm/* (~90 líneas)
```

Cada módulo exporta un `React.Fragment` con sus `<Route>` hijos. `<Routes>` acepta fragments en su árbol (react-router v6+).

### Patrón de cada archivo

```tsx
// src/routes/adminRoutes.tsx
import { lazy } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
// ... resto de lazy() locales al grupo

export const adminRoutes = (
  <Route
    element={
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <AdminLayout />
      </ProtectedRoute>
    }
  >
    <Route path="/admin" element={<AdminDashboard />} />
    {/* ... */}
  </Route>
);
```

### `routes.tsx` final

```tsx
import { Routes } from "react-router-dom";
import { publicRoutes } from "./routes/publicRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { appRoutes } from "./routes/appRoutes";

export const AppRoutes = () => (
  <Routes>
    {publicRoutes}
    {portalRoutes}
    {adminRoutes}
    {appRoutes}
  </Routes>
);
```

## Tests

- **Existentes**: el guardrail D14 (`oversized > 200 = 0`) ya verifica que ningún archivo nuevo se pase. No se requieren tests adicionales — los splits son puramente estructurales y las rutas siguen siendo strings idénticos.
- **Smoke** (opcional, descartado): tests de integración de rutas tomarían >1h y aportan poco vs. el riesgo (cambio cero en paths o elementos).

## Entregables

- **Nuevos**: `src/routes/{publicRoutes,portalRoutes,adminRoutes,appRoutes}.tsx`.
- **Modificado**: `src/routes.tsx` → orchestrator ~30 líneas.
- **`CHANGELOG.md`** entrada `[11.65.0]`.
- **`src/constants/appVersion.ts`** → `11.65.0`.
- **`.lovable/plan.md`** → D12 ✅ cerrado.

## Fuera de alcance

- Renombrar paths de rutas.
- Tocar guards (`ProtectedRoute`, `PortalProtectedRoute`) ni layouts.
- Mover archivos de `pages/` ni cambiar lazy chunk grouping.
- Tests de integración de routing.

## Criterio de éxito

- `bun run build` ✔ y app navega como antes.
- `audit-report.json` → `oversized = []` (todos los archivos < 200 líneas, `routes.tsx` ahora ~30, los hijos ~20-90).
- 0 cambios visibles para el usuario.

## Próximo (post-D12)

Fase 3 — **P1.5** (unificar `utils/`) y **D13** (monitoreo continuo 180-200).
