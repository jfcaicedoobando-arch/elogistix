# Revisión de errores de Sentry

## Hallazgo
Solo hay **un** error sin resolver:

- **`JAVASCRIPT-REACT-1M`** — *"Could not find a relationship between 'proveedor_facturas_conceptos' and 'conceptos_costo'"* (PGRST200)
  - Release reportada: `libre-carga@13.136.11`
  - Versión actual del proyecto: `13.137.13`
  - Ya se arregló en **13.137.11** reescribiendo `fetchCostosConFactura` con el patrón de dos pasos (sin embed `!inner`).

Verifiqué `src/features/embarques/services/costosConFactura.ts` y confirma que la consulta actual hace dos `select` separados, no usa el embed que disparaba el PGRST200. Los eventos que siguen llegando son de navegadores con el bundle anterior en caché — el handler de `vite:preloadError` los recarga automáticamente la próxima vez que naveguen.

## Acción
1. Marcar `JAVASCRIPT-REACT-1M` como **resolved in next release** en Sentry, con un comentario breve indicando que el fix ya está desplegado desde `13.137.11`.
2. **No se requieren cambios de código.**
3. **No se bumpea versión** ni se toca `CHANGELOG.md` (no hay cambios funcionales).

## Analogía para principiante
Es como si ya hubieras puesto un parche en la llanta, pero algunos coches todavía traen rines viejos en la cajuela: en cuanto cambien por el nuevo (recarga del bundle) dejan de reportar la fuga. Le decimos a Sentry "ya está, ignóralo a partir de la próxima versión".
