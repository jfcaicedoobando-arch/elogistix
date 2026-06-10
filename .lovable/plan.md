## Problema
Juan Luis (`juanluis.martinez@elogistixshipping.com`) tiene rol **coordinador_logistico**. Las rutas `/costeo/*` no tienen guard de rol, pero el sidebar (`useAppSidebarSections.ts`) sólo muestra la sección "Costeo" en la rama default (admin / admin_org / super_admin). Los roles `coordinador_logistico`, `operador` y `ejecutivo_pricing` devuelven arrays fijos sin esa sección, por lo que no ven el menú y creen que no tienen acceso.

## Cambio
Agregar `{ label: "Costeo", items: SIDEBAR_COSTEO_ITEMS }` a las ramas de:
- `coordinador_logistico` / `operador`
- `ejecutivo_pricing`

La sección se posicionará entre "Gestión" y "Reportes/Directorio" para mantener coherencia visual con la rama default.

## Archivos a tocar
- `src/hooks/layout/useAppSidebarSections.ts` — agregar `SIDEBAR_COSTEO_ITEMS` en 2 bloques condicionales.
- `src/constants/appVersion.ts` — bump a `12.77.1`.
- `CHANGELOG.md` — entrada breve.

## Fuera de alcance
- No se agrega `Costeo` a `gerente_operaciones`, `contador`, `tesorero`, `vendedor`, `viewer`, `customer_service` (no fueron solicitados).
- No se agregan guards de ruta (las rutas ya están abiertas; esto solo es visibilidad del menú).