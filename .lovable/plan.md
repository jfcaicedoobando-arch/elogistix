## Problema

En `src/pages/cxp/Cxp.tsx` el botón "Capturar factura" (y su gemelo en el empty state) están envueltos con `{isAdmin && (...)}`. `isAdmin` solo es true para roles admin del tenant, por lo que **contador** (Isela) no lo ve, aunque sí tiene permiso financiero (`canEdit = canEditOperations || canEditFinance` y contador está en `FINANCE`).

Las columnas de la tabla ya usan correctamente `canEdit` para acciones de pago/edición, así que el contador puede registrar pagos pero no crear facturas — incongruente.

## Cambio

**`src/pages/cxp/Cxp.tsx`** — reemplazar las dos guardas `isAdmin && (...)` (líneas 97 y 132) por `canEdit && (...)`. Quitar `isAdmin` de la desestructuración de `usePermissions` ya que deja de usarse.

Esto habilita "Capturar factura" para contador, tesorero, admin y super_admin (todos los roles con `canEditFinance` u `canEditOperations`), consistente con el resto de la página.

## Versionado

Bump `APP_VERSION` → `12.76.27` + entrada en `CHANGELOG.md`.

## Archivos afectados

- `src/pages/cxp/Cxp.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`
