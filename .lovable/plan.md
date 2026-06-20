## Estado del plan "Umbrales por organización"

| # | Paso | Estado |
|---|------|--------|
| 1 | UI por organización (`TabOperaciones.tsx`) | ✅ Hecho |
| 2 | Pestaña "Operaciones" en `/configuracion` | ✅ Hecho |
| 3 | Quitar pestaña de Super Admin + borrar `TabOperacionesGlobal.tsx` | ✅ Hecho |
| 4 | Lectura de umbrales por tenant (`useUmbralesReconciliacion`) | ✅ Hecho |
| 5 | Changelog `[13.71.3]` + bump `APP_VERSION` | ✅ Hecho |
| Extra | Migración BD: unicidad `(organization_id, categoria, clave)` + RLS por org + seed de defaults | ✅ Hecho (no estaba previsto, fue necesaria porque `configuracion` era global) |

## Pendiente

Sólo queda **1 tarea menor** del plan:

### Actualizar memoria del proyecto
- `mem://features/versionado-cotizaciones-reconciliacion`: anotar que los umbrales son **por organización** (no globales) y que viven en categoría `operaciones` con claves `reconciliacion_varianza_alerta_pct` / `reconciliacion_varianza_critica_pct`.

### Opcional (decisión tuya, lo dejé pendiente porque no respondiste)
- **Default global editable por Super Admin** que cada tenant pueda sobrescribir. Hoy el default está hardcoded en `UMBRALES_DEFAULT` (10% / 25%). Si quieres que el dueño de Libre Carga pueda cambiar ese valor sugerido sin tocar código, habría que:
  - Reactivar una mini-pestaña en `/admin/configuracion` que escriba en `configuracion_global`.
  - Hacer que `useUmbralesReconciliacion` use ese global como fallback antes de `UMBRALES_DEFAULT`.

¿Quieres que (a) sólo actualice la memoria y cerremos, o (b) además implemente el default global del Super Admin?
