# Paso 8 — Consolidar `src/pages/` en `features/*/routes/`

Movemos los 85 archivos restantes de `src/pages/` a la carpeta `routes/` (o `components/`/`data/` cuando no son rutas) del feature correspondiente, actualizamos `src/routes/appRoutes.lazy.ts` y todos los imports cruzados.

## Mapeo propuesto

| Origen (`src/pages/`)            | Destino (`src/features/`)                          |
| -------------------------------- | -------------------------------------------------- |
| `dashboard/Dashboard.tsx`        | `dashboard/routes/Dashboard.tsx`                   |
| `dashboard/Operaciones.tsx`      | `operaciones/routes/Operaciones.tsx`               |
| `dashboard/Reportes.tsx`         | `reportes/routes/Reportes.tsx`                     |
| `dashboard/Bitacora.tsx`         | `dashboard/routes/Bitacora.tsx`                    |
| `dashboard/Ayuda*.{tsx,ts}`      | `dashboard/routes/`                                |
| `admin/*.tsx`                    | `admin/routes/` (incluye `BackfillLegacyCard`)     |
| `admin-org/*.tsx`                | `admin/routes/admin-org/`                          |
| `auth/{Login,ResetPassword,NotFound,TrackingPublico,Unsubscribe}.tsx` + `components/`, `ForgotPasswordDialog.tsx` | nueva `features/auth/routes/` + `features/auth/components/` |
| `bandejas/*.tsx`                 | `bandejas/routes/`                                 |
| `comisiones/Comisiones.tsx`      | `comisiones/routes/Comisiones.tsx`                 |
| `cxp/Cxp.tsx`                    | `cxp/routes/Cxp.tsx`                               |
| `facturacion/FacturaDetalle.tsx` | `facturacion/routes/FacturaDetalle.tsx`            |
| `portal/*.tsx`                   | `portal/routes/`                                   |
| `profit/*.tsx`                   | `profit/routes/`                                   |
| `proveedores/*.{tsx,ts}`         | `proveedor/routes/` (Detalle, Proveedores) y `proveedor/components/` (tablas/dialogos/cards/columns) |
| `tesoreria/*.tsx`                | `tesoreria/routes/`                                |
| `onboarding/Onboarding.tsx`      | `onboarding/routes/Onboarding.tsx`                 |
| `marketing/*` (incl. `sections/` y `*.data.ts` + `landingCopy`) | nueva `features/marketing/routes/` y `features/marketing/components/sections/` |
| `legal/*.tsx`                    | nueva `features/legal/routes/`                     |
| `dev/PdfPreviewCotizacion.tsx`   | nueva `features/dev/routes/` (sólo dev)            |

## Actualizaciones

1. `git mv` por carpeta para preservar historial.
2. Reescribir `src/routes/appRoutes.lazy.ts` apuntando a los nuevos paths.
3. Buscar `rg "@/pages/"` y actualizar cada import (tests, hooks que referencian columns, etc.).
4. Verificar que `src/__tests__/architecture/fase2-pages-and-formatters.test.ts` y `fase3-4-reubicaciones.test.ts` no rompan; ajustar guardarriel si bloquea los nuevos paths.
5. Correr `bunx vitest run` completo y revisar 0 regresiones.
6. Bumpear `APP_VERSION` → `13.81.0` y agregar entrada en `CHANGELOG.md`.

## Riesgos

- `marketing/` y `legal/` no tienen feature aún → se crean carpetas nuevas.
- `proveedores/` mezcla rutas con componentes de tabla; se reparten entre `routes/` y `components/`.
- `auth/components/{LoginForm,SignupForm}` y `ForgotPasswordDialog` se mueven a `features/auth/components/`.
- `src/lib/__tests__/architecture.test.ts` puede tener reglas sobre paths legacy → ajustar.

## Pregunta

¿Procedo con el mapeo completo en una sola pasada, o prefieres dividirlo en 2-3 turnos (por ejemplo: 1º admin/dashboard/tesoreria/portal/profit, 2º auth/proveedores/bandejas/cxp/facturacion/comisiones, 3º marketing/legal/onboarding/dev)?
