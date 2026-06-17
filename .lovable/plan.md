## Podar `appRoutes.tsx` a ≤195 líneas

### Cambio
Introducir un helper local `guarded(roles, element)` que reemplaza el patrón repetido `<Route ... element={<ProtectedRoute allowedRoles={[...]}>...</ProtectedRoute>} />` (14 ocurrencias, cada una ocupa 6-8 líneas).

```tsx
const guarded = (roles: AppRole[], element: ReactNode) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);
```

Cada ruta protegida queda en **una sola línea**:

```tsx
<Route path="/cxp" element={guarded(["admin","super_admin","contador","tesorero","auxiliar_contable"], <Cxp />)} />
```

### Impacto
- 14 rutas × ~5 líneas ahorradas ≈ 70 líneas menos. Archivo final estimado: **~135-140 líneas** (margen amplio sobre el umbral 195).
- Cero cambio funcional: mismas rutas, mismos roles, mismo orden.
- Sin tocar `crmRoutes.tsx`, `appRoutes.lazy.ts`, ni `ProtectedRoute`.

### Verificación post-cambio
1. `wc -l src/routes/appRoutes.tsx` → confirmar ≤195.
2. `bunx vitest run src/routes/__tests__/routes.smoke.test.tsx` → smoke de rutas sigue verde.
3. Actualizar `reports/audit-report.md` hallazgo 9 a la nueva línea-cuenta.
4. Bump `APP_VERSION` → `13.56.8` + entrada en `CHANGELOG.md`.

### Riesgo
Muy bajo: refactor mecánico de un único patrón JSX, validado por el smoke test existente y el typecheck (`AppRole[]` tipa los roles).
