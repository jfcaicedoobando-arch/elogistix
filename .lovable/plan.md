# Fix: filas de documentos cambian de posición al marcar "No aplica"

## Causa
El RPC `public.get_embarque_full` arma el array `documentos` con `jsonb_agg(to_jsonb(d.*))` **sin `ORDER BY`**. Postgres devuelve filas en orden arbitrario del heap, y ese orden puede cambiar tras un `UPDATE` (por ejemplo, al marcar un documento como "No aplica"), porque la fila actualizada se reubica físicamente. Por eso "Packing List" salta al final tras togglear.

El portal del cliente (`fetchPortalDocumentos`) ya ordena por `created_at`; sólo el detalle interno carece de orden.

## Cambio
Nueva migración que reemplaza `get_embarque_full` agregando orden estable al `jsonb_agg` de documentos:

```sql
'documentos', COALESCE((
  SELECT jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at, d.id)
  FROM documentos_embarque d
  WHERE d.embarque_id = p_embarque_id
), '[]'::jsonb),
```

`created_at` refleja el orden de inserción, que coincide con la lista canónica de `getDocsForMode` (BL Master → BL House → Packing List → Factura Comercial → …). Se añade `d.id` como desempate determinista. Resto del RPC y firma sin cambios (mismo `SECURITY INVOKER`, `STABLE`, `search_path = public`, mismo `GRANT`).

## Archivos
- **Nueva migración** `supabase/migrations/...sql` — `CREATE OR REPLACE FUNCTION public.get_embarque_full` con el ORDER BY agregado.
- **`CHANGELOG.md`** — entrada 12.51.11: "Fix: documentos del embarque ya no cambian de posición al marcar 'No aplica' (orden estable por fecha de creación)."
- **`src/constants/appVersion.ts`** — bump a `12.51.11`.

## Fuera de alcance
- Frontend (`TabDocumentos`, `useDocumentoColumns`): no se toca; ya renderiza en el orden recibido.
- Portal: ya ordenado correctamente.
- Otras secciones del RPC (conceptos, facturas): no presentan el síntoma reportado.
