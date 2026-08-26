# D-01: candado a la columna `deleted_at` (papelera a prueba de manos)

## El problema real

Hoy cualquier usuario con permiso de edición sobre un registro puede, desde la API de datos, mandar directamente `deleted_at = null` y "resucitar" un registro de la papelera. Eso salta:

- el filtro de rol de la papelera (`restore_record` sólo permite super admin, admin u operador);
- la restauración en cascada de embarques (el padre revive pero sus hijos siguen borrados);
- la trazabilidad de quién restauró.

También puede mandar `deleted_by` de otra persona o una fecha de borrado falsa (retroactiva o futura), lo que ensucia la papelera y las auditorías.

Analogía: hoy la papelera tiene candado en la puerta (`restore_record`), pero la ventana de al lado está abierta.

## Diferencia con lo propuesto en el parche

El parche original bloquea toda escritura a `deleted_at` desde la API. Eso rompería la app: el frontend borra en suave con `update({ deleted_at })` directo en ~12 lugares (cuentas bancarias, seguros, contenedores, plantillas, leads, oportunidades, pagos a proveedor, conciliación manual, entre otros), y varias funciones internas de recálculo también tocan filas borradas.

Propuesta: no bloquear la columna, sino **controlar las transiciones válidas**. Se permite borrar; se prohíbe revivir por la ventana.

## Solución

### Etapa 1 — Trigger guardián en las tablas de papelera

Nueva función `public._guard_soft_delete()` con trigger `BEFORE UPDATE` en las 29 tablas de la allowlist de papelera (las que `public.is_soft_delete_table` reconoce):

1. **Restaurar sólo por la puerta**: si `deleted_at` pasa de un valor a `NULL`, se rechaza con `LC_RESTORE_DIRECTO` salvo que la operación venga de las funciones oficiales de papelera (marca de sesión `lc.papelera_restore`, mismo mecanismo de GUC que ya usamos en los candados de cancelación de v13.753.0).
2. **Fecha de borrado honesta**: al borrar, `deleted_at` se normaliza a `now()`; no se aceptan fechas retroactivas ni futuras.
3. **Autoría honesta**: `deleted_by` se fija a `auth.uid()` cuando hay sesión, ignorando lo que mande el cliente.
4. **Sin re-borrado silencioso**: si la fila ya estaba borrada, `deleted_at` no se puede mover a otra fecha.

El trigger no aplica a `service_role` (edge functions y jobs), para no romper procesos internos.

### Etapa 2 — Habilitar la marca en las funciones oficiales

`public.restore_record`, `public.restaurar_embarque_cascade` y cualquier otra función de restauración fijan `lc.papelera_restore` (local a la transacción) antes del `UPDATE`, con higiene H6 (`SECURITY DEFINER`, `search_path`, `REVOKE ... FROM PUBLIC, anon`).

### Etapa 3 — Frontend

- Confirmar que ningún servicio escribe `deleted_at = null` en tablas de papelera (la auditoría de hoy sólo encontró restauración directa en `cliente_documentos` y `proveedor_documentos`, que están fuera de la allowlist y conservan su flujo actual).
- Mensaje amable en la capa de errores: si llega `LC_RESTORE_DIRECTO`, mostrar "Para restaurar este registro usa la Papelera".

### Etapa 4 — Pruebas y sincronización

- Nueva prueba SQL `supabase/tests/d01_guard_soft_delete.sql`: restaurar directo falla, `restore_record` con rol válido funciona, fecha retroactiva se normaliza, `deleted_by` suplantado se corrige.
- Espejos canónicos de las funciones tocadas, `migration-manifest.json`, `supabase/schema/baseline.sql`, `CHANGELOG.md` y `APP_VERSION` (13.757.0).

## Detalles técnicos

- Migración nueva bajo `supabase/migrations/`, con `DO` loop que crea el trigger sólo en tablas con columna `deleted_at` y presentes en la allowlist de papelera, para no dejar tablas fuera al crecer el catálogo.
- Excepciones con códigos semánticos (`LC_RESTORE_DIRECTO`) para poder mapearlos en la UI.
- Sin cambios de RLS ni de GRANTs: el candado es de integridad, no de visibilidad.
- Riesgo controlado: si algún flujo interno legítimo necesita revivir filas, se le agrega la marca de sesión en su propia función en lugar de debilitar el trigger.
