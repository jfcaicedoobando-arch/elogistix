## Plan: corregir error Sentry `column "monto_total" does not exist`

### Diagnóstico

Las RPCs `embarque_admin_pendientes_resumen(uuid)` y `embarques_admin_pendientes_count()` consultan `SUM(monto_total) FROM conceptos_venta`, pero esa tabla tiene columna `total`, no `monto_total`. Cualquier vista que abre el resumen de pendientes admin (incluyendo `/inicio` desde el menú móvil que carga el embarque actual) revienta con el error.

**Analogía**: es como pedir la "talla XXL" en una tienda donde sólo existe "XL" — el sistema responde "no tengo esa columna".

### Solución

Crear una nueva migración que **reemplaza ambas funciones** sustituyendo `SUM(monto_total)` por `SUM(total)` (3 ocurrencias). Mantengo el resto del cuerpo idéntico — sin tocar grants, lógica ni firmas.

### Archivos

- **Nuevo**: `supabase/migrations/<timestamp>_fix_conceptos_venta_total_column.sql` — recrea las 2 funciones con la columna correcta.
- `src/constants/appVersion.ts` → `13.97.1` (patch).
- `CHANGELOG.md` → entrada `fix(rpc) embarque_admin_pendientes_*: corrige referencia a columna inexistente`.

### Validación

- `supabase--migration` aplica el cambio.
- Smoke test con `supabase--read_query` invocando ambas RPCs sobre un embarque real para confirmar que ya no truenan.
- El error en Sentry quedará resuelto en el próximo deploy; opcionalmente puedo cerrarlo después con `update_issue`.
