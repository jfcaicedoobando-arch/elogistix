## Diagnóstico

Al revisar el embarque ELIMP00203 en la base de datos:

- `etd = 2026-04-20`, `eta = 2026-05-17`, `fecha_llegada_real = NULL`, `updated_at = 2026-05-09` (anterior al click).
- Aunque el toast dijo "Fechas actualizadas en el embarque", **no se persistió ningún cambio** en `embarques`.
- El payload de JSONCargo trae:
  - `atd_origin = 2026-04-07 01:51` → ETD propuesto (distinto del actual).
  - `eta_final_destination = NULL` → no propone ETA.
  - `container_status = "Import Gate-Out from Port of Discharge to Customer"` (claramente ya descargado).
  - `discharging_port = NULL` y `last_location = "MANZANILLO, MEXICO"`.
  - `timestamp_of_last_location = 2026-05-03 05:50` (ATA inferible).

Dos problemas:

1. **Mutación silenciosa**: `supabase.from("embarques").update(...).eq("id", ...)` no agrega `.select()`. Si RLS u otro motivo devuelve 0 filas, no lanza error — la UI muestra éxito y nada cambia. No tenemos forma de detectarlo hoy.
2. **ATA no se infiere** cuando `discharging_port` viene nulo: la heurística exige `last_location.includes(discharging_port)`. Pero el `container_status` ya indica "Gate-Out from Port of Discharge" → suficiente para inferir ATA aunque `discharging_port` esté vacío.

Adicionalmente, la invalidación de queries ya está correcta (`['embarques']` cubre `['embarques','full',id]`), por lo que en cuanto el UPDATE persista, el Resumen sí debe refrescar.

## Cambios

### 1. `src/hooks/embarque/useJsonCargoTracking.ts`

**`useApplyJsonCargoFechas`**
- Cambiar a `.update(update).eq("id", embarqueId).select("id")`.
- Si `data.length === 0`, lanzar error `No se pudo actualizar el embarque (sin permisos o registro no encontrado)`.

**`extractSummary` – heurística ATA más robusta**
- Mantener la regla actual (last_location coincide con discharging_port + status descargado).
- Añadir fallback: si `discharging_port` es nulo/empty pero `container_status` contiene patrones inequívocos de descarga en puerto destino (`gate.?out.*port.*discharge`, `discharged at port`, `discharged from vessel`, `unloaded at port`, `available for (pick|release)`, `released`, `delivered`), tomar `timestamp_of_last_location` (o `last_movement_timestamp`) como `ata_effective` y marcar `ata_is_inferred = true`.
- No inferir si solo dice "on rail", "in transit to" sin contexto de puerto.

### 2. `supabase/functions/_shared/jsoncargo.ts`

Replicar el mismo fallback en `pickEffectiveAta(d)` para que el `summary` del edge function también devuelva la ATA cuando `discharging_port` venga nulo y el `container_status` indique descarga clara en puerto.

### 3. Changelog y versión

- `APP_VERSION` → `8.135.1` (patch).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/pages/Changelog.tsx`:
  - "Tracking: la acción Actualizar embarque ahora valida que el UPDATE se haya aplicado y muestra error si RLS o un registro inexistente lo bloquea."
  - "Tracking: la ATA se infiere también cuando JSONCargo no reporta discharging_port pero el estado indica descarga en puerto (p. ej. 'Gate-Out from Port of Discharge')."

## Resultado esperado para ELIMP00203 / TEMU7687933

- Al pulsar **Actualizar embarque**: se aplican ETD = 2026-04-07 y ATA = 2026-05-03 al embarque, el Resumen se refresca automáticamente y se muestra "Llegada Real".
- Si por cualquier razón el UPDATE no persiste, ahora se mostrará un toast de error en vez de un falso éxito.
