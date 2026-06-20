## Problema detectado

Tienes razón: los umbrales de varianza (alerta y crítico) para la reconciliación 3 columnas son una **decisión operativa de cada empresa**, no del dueño de Libre Carga. Cada forwarder tolera diferente margen de error.

Actualmente quedaron en `/admin/configuracion` → pestaña "Operaciones" (solo Super Admin), lo cual está mal.

## Plan: mover umbrales a configuración por tenant

### 1. Mover UI a Configuración por organización
- Crear `TabOperacionesOrganizacion.tsx` en `src/features/configuracion/components/` (o donde vivan los tabs por tenant).
- Reutilizar los dos inputs (`reconciliacion_varianza_alerta_pct`, `reconciliacion_varianza_critica_pct`) con la misma validación (crítico > alerta).
- Usar `useConfiguracion` / `useUpdateConfiguracion` (tabla `configuracion`, scoped por `organization_id`) en lugar de `configuracion_global`.

### 2. Agregar pestaña "Operaciones" en `/configuracion`
- Localizar el `AdminConfiguracion`/`Configuracion` por tenant (ruta `/configuracion`) y añadir `TabsContent value="operaciones"` con ícono `Scale`.
- Visible para **Admin de organización** (no requiere Super Admin).

### 3. Quitar pestaña de Super Admin
- Eliminar `TabOperacionesGlobal.tsx` y su `TabsContent` en `AdminConfiguracion.tsx`.
- No tocar `configuracion_global` (queda libre por si en el futuro se necesita un default global, pero sin UI por ahora).

### 4. Ajustar lectura de umbrales en reconciliación
- En `useReconciliacion3Columnas` (o donde se consuman los umbrales), leer desde `configuracion` del tenant activo.
- Fallback a `UMBRALES_DEFAULT` de `versionadoCotizacion.ts` si el tenant no ha configurado valores.

### 5. Changelog + versión
- `CHANGELOG.md`: entrada `[13.71.3]` — "Umbrales de reconciliación movidos a configuración por organización".
- Bump `APP_VERSION` a `13.71.3`.

### Notas técnicas
- No requiere migración de BD: `configuracion` ya soporta llaves arbitrarias por tenant.
- Mantener constantes `UMBRALES_DEFAULT` como fallback compartido.
- Memoria a actualizar: `mem://features/versionado-cotizaciones-reconciliacion` para reflejar que los umbrales son por tenant.

¿Apruebas que lo mueva tal cual, o quieres además dejar un **default global** editable por Super Admin que cada tenant pueda sobrescribir?
