## Objetivo

Crear página dedicada `/proformas` con listado completo (igual que el tab actual dentro de Facturación), accesible directamente desde el sidebar.

## Alcance

1. **Nueva ruta `/proformas`** registrada en `src/routes/appRoutes.tsx` (lazy-loaded, dentro del layout autenticado, mismas guardas que `/facturacion`).
2. **Nueva página `src/features/proformas/routes/ProformasListado.tsx`**:
   - `PageHeader` con título "Proformas" y descripción breve.
   - Reutiliza `<TabProformas />` (ya tiene búsqueda, filtros Todas/Pendientes/Facturadas, conteos, paginación, export CSV y dialog "Marcar facturada").
   - El click en fila ya navega a `/proformas/:id` (detalle existente).
3. **Sidebar**: añadir entrada "Proformas" en `src/components/layout/sidebarItems.ts` (icono `FileText`), debajo o cerca de "Facturación". Visible para los mismos roles que ven Facturación.
4. **Breadcrumb**: añadir entrada `proformas` → "Proformas" en `src/components/layout/Breadcrumbs.tsx`.
5. **Versionado**: bump `APP_VERSION` a `13.94.0` + entrada en `CHANGELOG.md`.

## Detalles técnicos

- No se duplica lógica: `TabProformas` y `useTabProformasController` ya encapsulan todo (filtros, paginación nuqs-friendly, CSV, marcar facturada). La nueva página es un wrapper delgado.
- No se toca el tab dentro de `/facturacion` — sigue funcionando ahí también, para no romper el flujo de Isela/contador.
- No requiere cambios de DB ni RLS (las proformas ya tienen políticas activas y `useProformas` filtra por `organizationId`).

## Fuera de alcance

- Filtros adicionales (por cliente, rango de fechas propio de la página). Si los necesitas después, se agregan en una iteración corta.
- Cambios al detalle `/proformas/:id` (ya existe).
