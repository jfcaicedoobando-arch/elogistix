## Bug: cotización no se libera al eliminar (soft) el embarque

### Diagnóstico (verificado en BD)
- COT-2026-0138 (`5fe12c7f…`): estado ya volvió a **`Aceptada`** ✅, pero `cotizaciones.embarque_id` **sigue apuntando** al embarque soft-deleted `69d42cb4…` (expediente `ELIMP00332`, estado `Borrador`, `deleted_at` seteado).
- El embarque soft-deleted **conserva** `cotizacion_id = 5fe12c7f…`.
- La UI (`CotizacionDetalle.tsx:100`) bloquea "Convertir a embarque" cuando `cotizacion.embarque_id` no es null **o** cuando `fetchEmbarquesVinculados` regresa filas. Este último **no filtra `deleted_at IS NULL`**, así que también cuenta el embarque borrado.

Causas:
1. `eliminar_embarque_completo` revierte `estado` pero no limpia `cotizaciones.embarque_id` ni `embarques.cotizacion_id` en el soft-delete.
2. `fetchEmbarquesVinculados` no excluye `deleted_at`.

### Cambios

**1. Fix de datos (insert tool)**
- `UPDATE cotizaciones SET embarque_id = NULL WHERE id = '5fe12c7f…' AND embarque_id = '69d42cb4…'`
- `UPDATE embarques SET cotizacion_id = NULL WHERE id = '69d42cb4…'`

**2. Migración: endurecer `eliminar_embarque_completo`**
Dentro del bloque `IF v_cotizacion_id IS NOT NULL … IF v_remaining = 0`, además de setear `estado='Aceptada'`:
- `UPDATE cotizaciones SET embarque_id = NULL WHERE id = v_cotizacion_id AND embarque_id = p_embarque_id;`
- `UPDATE embarques SET cotizacion_id = NULL WHERE id = p_embarque_id;`

Así, el próximo soft-delete deja la cotización totalmente libre para re-convertirse.

**3. Código: `fetchEmbarquesVinculados`**
Agregar `.is("deleted_at", null)` para que la vinculación sólo considere embarques vivos. Defensa en profundidad por si algún registro histórico quedó con FK sucia.

**4. Guardrails**
- Test de `eliminar_embarque_completo`: la migración incluye `UPDATE public.cotizaciones SET embarque_id = NULL`.
- Test unitario de `fetchEmbarquesVinculados`: la query aplica `.is("deleted_at", null)`.

**5. Housekeeping**
- Bump `APP_VERSION` (patch).
- Entrada en `CHANGELOG.md` describiendo el fix.

### Notas
- No se toca lógica de negocio adicional (transición de estados, RLS, etc.).
- El fix de datos usa el insert tool; la migración solamente redefine la función.