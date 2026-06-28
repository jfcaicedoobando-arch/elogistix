## Lote C — Fixes navegación + UI crítica (Auditoría 3ª pasada)

Corregir los 5 hallazgos que rompen navegación o muestran datos crudos. Sin tocar lógica de negocio.

### F-01 / F-02 — Rutas "Por emitir" y "Cobranza" dan 404

**Causa**: `sidebarItems.ts` apunta a `/facturacion/por-emitir` y `/cartera`, pero el sidebar dinámico (vía `useAppSidebarSections`) o algún builder de rol está reescribiendo a `/bandejas/facturacion-por-emitir` y `/bandejas/cartera` (rutas que no existen en `appRoutes.tsx`).

**Fix**: Auditar `src/hooks/layout/sidebarRoleBuilders.ts` + `appRoutes.tsx`. Alinear URLs del sidebar con las rutas reales registradas. Validar con `rg "facturacion-por-emitir|bandejas/cartera"`.

### F-03 — "Buenos días □" (emoji corrupto)

**Causa**: En el saludo del Dashboard hay un emoji (probablemente 👋 o ☀️) que no renderiza por fuente o por codificación.

**Fix**: Localizar el string en `src/features/dashboard/routes/Dashboard.tsx` (o componente de saludo). Reemplazar emoji por icono Lucide (`Sun`, `Hand`) o eliminar el carácter.

### F-04 — 11 tabs en detalle de embarque desbordan a 2ª línea

**Causa**: `TabsList` con `grid-cols-N` fijo o flex sin scroll horizontal en `EmbarqueDetalle.tsx`.

**Fix**: Convertir `TabsList` a scroll horizontal (`overflow-x-auto`, `flex-nowrap`, `whitespace-nowrap`) o agrupar tabs secundarias bajo un dropdown "Más". Preferir scroll horizontal por ser menos disruptivo.

### F-05 — UUID crudo en columna "Contenedor" *(incluido por relación con F-04 — opcional)*

**Causa**: La columna muestra `embarque.tipo_contenedor` directamente cuando es UUID nuevo.

**Fix**: Usar `resolveTipoContenedorNombre()` (ya existe en `src/features/cotizacion/utils/`) en la columna del DataTable de embarques.

> **Nota**: F-05 sólo si ya está en alcance del lote; si quieres dejarlo fuera, lo movemos al siguiente.

### F-06 — Embarques y CXP: columnas finales truncadas sin scroll horizontal

**Causa**: Tabla envuelta en contenedor sin `overflow-x-auto`, o `min-w` insuficiente en la `<table>`.

**Fix**: En los wrappers de DataTable de `/embarques` y `/cxp`, agregar `overflow-x-auto` al contenedor y `min-w-max` a la tabla. Verificar que el sticky header (si existe) sigue funcionando.

### Verificación

Tras los fixes, re-capturar con Playwright las 4 rutas afectadas (`/`, `/embarques`, `/embarques/:id`, `/cxp`) y los 2 enlaces de sidebar corregidos. Confirmar visualmente que:
- Los enlaces ya no dan 404.
- El saludo se ve limpio.
- Los tabs caben o hacen scroll horizontal suave.
- Las tablas muestran todas las columnas (con scroll si es necesario).

### Changelog + versión

Bump `APP_VERSION` (patch) + entrada en `CHANGELOG.md` con los 5 (o 6 con F-05) fixes.

### Fuera de alcance de este lote

- F-07 (botón "Sin Cambios" en Configuración) — Medio
- F-08 (tarjeta "Tiempo medio resolución" sin valor) — Medio
- F-09 (pageSize 100 en Clientes) — Bajo
- F-10 (breadcrumb minúscula) — Bajo

Se atacan en Lote D después de validar este.
