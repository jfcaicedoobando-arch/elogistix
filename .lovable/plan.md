## Diagnóstico

Analogía primero: el dashboard del operador tiene un widget "Sin tracking reciente" que funciona como un **cuaderno de bitácora** — cuenta los días desde la última anotación en `eventos_embarque` (los registros del tab Tracking). Si no hay anotación nueva, el widget "cree" que nadie tocó el embarque, aunque en la BD sí haya habido cambios.

### Qué encontré para ELIMP00263

- El embarque **no está en la lista de "Alertas de demora"** del dashboard (que sí filtra por `eta` en el pasado).
- El "26D" viene del widget **"Sin tracking reciente"** (`useSinTrackingOperador` → `fetchSinTrackingOperador`).
- Estado real hoy: `eta = 2026-07-13` (5 días en el futuro), `eta_original = 2026-07-06`, `estado = En Tránsito`, `updated_at = 2026-07-07`. Es decir, **Valeria sí actualizó el ETA** — de 6-jul a 13-jul.
- Sin embargo, `eventos_embarque` para este embarque sólo contiene **UN registro**: `Zarpe` del 11-jun-2026. Han pasado ~27 días desde ese evento → badge "26d".

### Causa raíz

Valeria actualizó el ETA el 7-jul (**un día antes de que se desplegara el rediseño del tab Tracking en v13.214.0**). Lo hizo desde el **wizard de edición del embarque**, que llama al RPC `actualizar_embarque_completo`. Ese camino **nunca inserta un evento en `eventos_embarque`**.

Sólo el nuevo flujo del tab Tracking (`useActualizarEta` + `useCreateEventoEmbarque`) deja huella en la bitácora. Cualquier otra ruta — wizard, admin RPC, corrección manual — modifica `embarques.eta` en silencio y el widget "Sin tracking reciente" se queda mostrando el conteo viejo.

Consulta de impacto: **16 embarques** tienen `eta_original ≠ eta` y no tienen ningún evento `Cambio de ETA`. Todos ellos están en la misma situación.

## Solución

### 1. Trigger de auditoría en `embarques` (BD)

Instalar `trg_embarques_log_eta_change`: `AFTER UPDATE ON embarques` que dispara cuando `NEW.eta IS DISTINCT FROM OLD.eta` e inserta en `eventos_embarque`:

- `tipo = 'Cambio de ETA'`
- `descripcion = 'ETA actualizada de {OLD.eta} a {NEW.eta}'`
- `fecha = now()`
- `usuario = COALESCE((auth.jwt()->>'email'), 'sistema')`
- `ubicacion = ''`

Extensión análoga para `fecha_llegada_real`: si cambia de NULL → fecha, insertar evento `Arribo a Puerto`. (El flujo del tab Tracking ya inserta ese evento, pero el trigger lo hace idempotente para el resto de rutas.)

**Nota**: el trigger no debe duplicar cuando el nuevo flujo del tab Tracking ya inserta el evento. Como el tab actualiza `eta` y luego llama a `crearEvento.mutateAsync`, quedarían dos eventos "Cambio de ETA" por acción. Para evitarlo, el trigger checa si ya existe un evento `Cambio de ETA` para ese embarque con `fecha` dentro de la ventana de los últimos 30 segundos; si existe, no inserta.

### 2. Backfill para los 16 embarques afectados

Migración one-shot: para cada embarque con `eta_original IS DISTINCT FROM eta` y sin evento `Cambio de ETA`, insertar uno con `fecha = updated_at`, `usuario = 'sistema (backfill)'`, `descripcion = 'ETA actualizada de {eta_original} a {eta} (registro histórico)'`. Esto refresca el widget para ELIMP00263 y los otros 15 casos.

### 3. Versión y changelog

- `APP_VERSION` → `13.214.3`.
- Entrada en `CHANGELOG.md` con la explicación y la analogía.

## Riesgos y verificación

- **Riesgo 1**: el trigger se dispara también cuando el nuevo flujo del tab Tracking cambia el ETA. Mitigación descrita arriba (ventana de 30s). Alternativa más limpia: usar `pg_temp` / setting local, pero la ventana temporal es suficiente y no requiere cambiar el frontend.
- **Riesgo 2**: rutas administrativas o scripts que ajusten `eta` con `usuario` desconocido crearán un evento con `usuario = 'sistema'`. Es aceptable — deja huella.
- **Riesgo 3**: `auth.jwt()` puede fallar en contexto sin sesión (jobs, migraciones). El `COALESCE` a `'sistema'` cubre ese caso; envolveremos la extracción en `BEGIN … EXCEPTION WHEN OTHERS THEN NULL` para máxima defensa.

**Verificación**: correr una consulta manual `SELECT id, expediente FROM embarques WHERE ...` post-backfill, confirmar que aparecen los 16 nuevos eventos, refrescar el dashboard de Valeria y validar que ELIMP00263 ya no aparece en "Sin tracking reciente".
