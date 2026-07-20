## Errores de Sentry (últimas 24h)

**Analogía**: Sentry es como el buzón de quejas. Hoy hay 3 papelitos:
- 2 son quejas viejas de una versión que ya arreglamos (los usuarios estaban en caché de `13.302.6`, y los fixes salieron en `13.302.9`/`13.302.10`).
- 1 es un bug real y nuevo: una consulta SQL escribe mal el nombre de una columna.

---

### 🔴 Bug real: `column pp.factura_id does not exist` — `JAVASCRIPT-REACT-2Y`

- **Dónde**: RPC `validar_cierre_embarque` (mig. `20260718203917`), línea 118.
- **Qué pasa**: al abrir el detalle de un embarque, React Query llama `validar_cierre_embarque` para pintar el gate del Tab Cierre. El JOIN usa `pp.factura_id`, pero la columna real en `pagos_proveedor` es `proveedor_factura_id`. La RPC truena, el detalle no puede validar cierre y aparece el error en Sentry.
- **Fix**: nueva migración `CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(...)` que cambia el JOIN a `pp.proveedor_factura_id = pf.id`. Es un cambio quirúrgico — el resto de la función (100+ líneas) se preserva verbatim.
- **Verificación**: `supabase--read_query` con `SELECT validar_cierre_embarque('403fee7b-8b1f-47c8-9e27-8afaca8a4458'::uuid)` debe regresar JSON válido sin error.

### 🟡 Ya arreglados en releases nuevas — sólo marcar `resolved`

- `JAVASCRIPT-REACT-2X` — `Borrador → En Tránsito`. Release `13.302.6`. Fix ya está en `v13.302.9` (`ESTADOS_AUTO_CALCULABLES` allowlist).
- `JAVASCRIPT-REACT-2V` — `En Aduana → Entregado`. Release `13.302.6`. Fix ya está en `v13.302.10` (sincronización de `ESTADOS_EMBARQUE` con el grafo BD).
- Acción: `update_issue` con `status: resolved` y `reason` apuntando al release donde se arregló.

---

### Entregables

1. `supabase/migrations/<timestamp>_fix_validar_cierre_embarque_col.sql` — `CREATE OR REPLACE` con `pp.proveedor_factura_id`.
2. `src/constants/appVersion.ts` → `13.302.12`.
3. `CHANGELOG.md` → entrada `[13.302.12]` referenciando `JAVASCRIPT-REACT-2Y`.
4. Marcar `2Y`, `2V`, `2X` como `resolved` en Sentry con `update_issue`.

### Fuera de alcance

- No tocar el resto del cuerpo de `validar_cierre_embarque` — el bug es una sola letra en el nombre de una columna.
- No tocar UI: el gate de cierre ya sabe manejar el error.
