## Lote D — Cierre de la 3ª pasada de auditoría visual

Atacar los 5 hallazgos pendientes (Medio y Bajo). Sin tocar lógica de negocio.

### F-05 — UUID crudo en columna "Contenedor" (Alto, residual)

**Causa**: La columna muestra `embarque.tipo_contenedor` directo. Cuando ya es UUID del catálogo nuevo, se ve como `a1b2c3d4-…` en vez de "40HC".

**Fix**: En las columnas del DataTable de `/embarques` (`src/features/embarques/components/...` — localizar archivo de columnas), usar el helper existente `resolveTipoContenedorNombre(value, catalogo)` pasando el catálogo de tipos de contenedor (hook `useTiposContenedor` o equivalente). Si la lista de embarques aún no tiene el catálogo cargado, agregar el query y memoizar.

### F-07 — Botón "Sin Cambios" en Configuración (Medio)

**Causa**: En `/configuracion`, cuando no hay cambios pendientes, el botón de submit cambia su label a "Sin Cambios" en estado disabled.

**Fix**: Mantener el label "Guardar" siempre. El estado `disabled` ya comunica visualmente que no hay nada que guardar. Localizar el botón en `src/features/configuracion/...` y quitar el ternario de label.

### F-08 — Tarjeta "Tiempo medio de resolución" sin valor (Medio)

**Causa**: En `/auditoria`, el KPI card de "Tiempo medio de resolución" muestra vacío cuando no hay hallazgos resueltos en la ventana.

**Fix**: Renderizar fallback `"Sin datos"` (o `"—"`) cuando el valor sea `null`/`undefined`/`NaN`. Localizar el componente del card en `src/features/auditoria/components/...`.

### F-09 — pageSize default 100 en Clientes (Bajo)

**Causa**: `/clientes` quedó en 100 cuando ya bajamos Embarques y Cotizaciones a 50 en Lote B (v13.139.17).

**Fix**: Bajar default a 50 en la página de Clientes (`src/features/cliente/routes/Clientes.tsx` o equivalente), alineado con las otras listas largas. El selector seguirá ofreciendo 100/200/500.

### F-10 — Topbar muestra "auditoria" en minúsculas (Bajo)

**Causa**: El breadcrumb / topbar deriva el título del slug de la ruta (`/auditoria`) sin capitalizar ni acentuar, mientras el H1 dice "Auditoría operativa".

**Fix**: Dos opciones — preferir la primera:
1. Mapear slugs conocidos a labels presentables en el componente de topbar (ya existe un mapping similar en `Breadcrumbs.tsx` o en el header). Agregar entrada `auditoria → "Auditoría"`.
2. Si no hay mapping, capitalizar la primera letra como fallback genérico.

### Verificación

- Re-screenshot con Playwright (1920×1080 simulado) de `/embarques`, `/configuracion`, `/auditoria`, `/clientes` y la topbar en `/auditoria`.
- Confirmar:
  - Columna "Contenedor" muestra "40HC" etc., no UUID.
  - Botón en Configuración dice "Guardar" (disabled cuando no hay cambios).
  - Card de tiempo medio muestra valor o "Sin datos".
  - Clientes default = 50 filas.
  - Topbar muestra "Auditoría" capitalizado.

### Changelog + versión

Bump `APP_VERSION` (patch, p.ej. `13.139.19`) + entrada en `CHANGELOG.md` con los 5 fixes y la nota de cierre de la 3ª pasada de auditoría visual.

### Resumen para programador principiante

Es como pasarle un trapo final a 5 esquinas que quedaron polvosas tras la limpieza grande: ninguna rompe nada, pero todas se notan cuando las ves de cerca. Cuando termine este lote, la 3ª pasada queda 100% cerrada.
