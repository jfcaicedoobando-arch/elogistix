## Diagnóstico

`/usuarios` y `/configuracion` están guardadas en `src/routes/appRoutes.tsx` con solo `["admin"]`. El `useAppSidebarSections` muestra la sección **Administración** para `admin`, `admin_org` y `super_admin`, así que el usuario `hector@lopezbenavides.com` (rol `admin_org`) ve el ítem pero al entrar choca con el guard de la ruta.

## Cambios

### 1. `src/routes/appRoutes.tsx` — ampliar guards
Cambiar los dos guards para incluir `admin_org` y `super_admin` (mismo patrón ya usado en `/cxp/por-capturar`, `/facturacion/por-emitir`, etc.):

```tsx
<Route path="/usuarios" element={guarded(["admin", "admin_org", "super_admin"], <Usuarios />)} />
<Route path="/configuracion" element={guarded(["admin", "admin_org", "super_admin"], <Configuracion />)} />
```

`/papelera` e `/idempotencia` se quedan como `["admin", "super_admin"]` (operaciones destructivas a nivel sistema, no para admin_org).

### 2. `src/routes/__tests__/appRoutes.smoke.test.tsx`
Actualizar las dos entradas del array `[ruta, rolesPermitidos]` para reflejar los nuevos roles:
- `["/usuarios", ["admin", "admin_org", "super_admin"]]`
- `["/configuracion", ["admin", "admin_org", "super_admin"]]`

### 3. Versionado y changelog
- Bump `APP_VERSION` → `13.106.2` (patch / bugfix).
- Entrada en `CHANGELOG.md`:
  - `fix(rbac)`: el rol `admin_org` (y `super_admin`) ahora puede entrar a `/usuarios` y `/configuracion`. Antes la sidebar los mostraba pero la ruta los rechazaba.

## Verificación

Después de aplicar:
1. Login con `hector@lopezbenavides.com` (admin_org) → clic en sidebar **Administración → Usuarios** → debe abrir la página sin redirección.
2. Misma verificación con **Configuración**.
3. Correr `bunx vitest run src/routes/__tests__/appRoutes.smoke.test.tsx`.

## Notas

- No requiere migración ni cambios en backend; es solo gating de UI/ruta.
- No se modifica `usePermissions`: la lógica fina dentro de `Usuarios` (por ejemplo, quién puede crear/eliminar) ya distingue roles internamente.
