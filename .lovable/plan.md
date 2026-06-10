## Problema

El rol **contador** (y también **tesorero**) ve los módulos **Cuentas por Pagar** y **Tesorería** en el menú lateral, pero al hacer clic `ProtectedRoute` los bloquea porque en `src/routes/appRoutes.tsx` esas rutas sólo permiten `["admin", "super_admin"]`. Por eso "no puede dar clic" (la ruta lo redirige).

Lo mismo aplica al grupo **Profit** que también aparece en el sidebar para contador/tesorero, pero `/profit/dashboard` y `/profit/presupuesto` están restringidas igual.

## Cambios

1. **`src/routes/appRoutes.tsx`** — ampliar `allowedRoles` para alinearlo con el sidebar del rol financiero:
   - `/cxp` → `["admin", "super_admin", "contador", "tesorero"]`
   - `/tesoreria`, `/tesoreria/cuentas`, `/tesoreria/conciliacion`, `/tesoreria/flujo` → `["admin", "super_admin", "contador", "tesorero"]`
   - `/profit/dashboard` y `/profit/presupuesto` → agregar `"contador"` y `"tesorero"` (el sidebar ya les muestra Profit).

   No se tocan otras rutas ni la lógica de `ProtectedRoute`. El sidebar ya filtra correctamente, así que ningún otro rol gana acceso nuevo.

2. **Versionado / changelog** — `APP_VERSION` → `12.76.26` y entrada en `CHANGELOG.md` describiendo el desbloqueo de CxP, Tesorería y Profit para contador/tesorero.

## Archivos afectados

- `src/routes/appRoutes.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Fuera de alcance

- No se modifican RLS ni servicios: las páginas ya consultan datos vía Supabase con políticas existentes; si alguna consulta financiera fallara por RLS para contador, se atendería en una iteración aparte con datos concretos del error.
