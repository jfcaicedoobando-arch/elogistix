
# Plan: corregir header "Pre-Facturación" → "Facturación"

## Causa

El **breadcrumb** (no el `PageHeader`) sigue mostrando "Pre-Facturación". Está hardcodeado en `src/components/layout/Breadcrumbs.tsx` línea 19:

```ts
facturacion: "Pre-Facturación",
```

El `PageHeader` interno ya dice "Facturación" correctamente; el header visible que el usuario ve es la barra superior con breadcrumbs.

## Cambios

1. **`src/components/layout/Breadcrumbs.tsx`**: cambiar `"Pre-Facturación"` → `"Facturación"` (1 línea).
2. **`src/features/dashboard/routes/ayudaContent.ts`**: actualizar las 3 menciones a "Pre-Facturación" en la sección de Ayuda para que no contradigan la nueva nomenclatura.
3. **Comentarios de código** (`useFacturacionPageController.ts`, `dashboardEjecutivo.ts`, `useTabProyeccionController.ts`, `useFacturacionDateRange.ts`, `GuiaPrefacturacion.tsx`, `DateRangeFilter.tsx`, `DashboardEjecutivoFacturacion.tsx`, `ProformaDetalle.tsx`): reemplazar "Pre-Facturación" por "Facturación" en los JSDoc. No cambia comportamiento, sólo limpieza.
4. **Bump** `APP_VERSION` → `13.93.1` + entrada de patch en `CHANGELOG.md`.

## Lo que NO cambia

- Nombre de archivos (`GuiaPrefacturacion.tsx`, `useFacturacionPageController.ts`, etc.) — renombrarlos rompería imports en muchos sitios y no aporta al usuario final.
- Rutas (`/facturacion`).
- Lógica de negocio.
