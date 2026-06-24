## Problema

En `/admin/organizaciones/:id` el breadcrumb muestra el UUID completo (`00000000-0000-0000-0000-000000000001`) en vez del nombre de la organización.

**Causa raíz:** `AdminLayout.tsx` define su **propio** componente `Breadcrumbs` local (líneas 9–44) que:
- Sólo conoce 4 etiquetas estáticas (`admin`, `organizaciones`, `usuarios`, `configuracion`).
- Para segmentos desconocidos hace `decodeURIComponent(p)` → muestra el UUID tal cual.
- Ignora por completo el `BreadcrumbContext` global y el truncado de UUIDs.

Ya tenemos el componente compartido `src/components/layout/Breadcrumbs.tsx` que sí resuelve UUIDs vía `useRegisterBreadcrumbLabel(id, org?.nombre)` — y `AdminOrgDetalle` ya lo invoca con `org?.nombre`. Sólo falta que el layout de admin lo consuma.

**Analogía:** la consola de super admin tenía un letrero hecho a mano que sólo sabía leer 4 palabras; el resto del edificio ya usa un letrero digital conectado al directorio. Vamos a poner el letrero digital también en super admin.

## Cambios

### `src/features/admin/components/AdminLayout.tsx`
- Importar el `Breadcrumbs` compartido desde `@/components/layout/Breadcrumbs`.
- Borrar el componente local `Breadcrumbs` y el diccionario `labels`.
- Envolver `<Outlet />` en `<BreadcrumbProvider>` (de `@/lib/contexts/BreadcrumbContext`) para que `useRegisterBreadcrumbLabel` funcione dentro del subárbol admin (igual que el layout principal lo hace).

### `CHANGELOG.md` + `APP_VERSION`
- Bump patch a `13.135.2` + entrada describiendo el fix.

## Fuera de alcance
- No tocar la lógica del breadcrumb global ni `AdminOrgDetalle`.
- No agregar etiquetas adicionales al diccionario global salvo que el typecheck lo exija.
