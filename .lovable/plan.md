

## Fix: Revert cotización status when deleting linked embarque

### Change: `src/hooks/useEmbarqueMutations.ts` — `useEliminarEmbarque`

Before the cascade deletion, add a query to read the embarque's `cotizacion_id`. After all deletions complete, check if other embarques remain linked to that cotización. If none remain, update the cotización status back to `'Aceptada'`.

Order of operations in `mutationFn`:
1. **Read** `cotizacion_id` from the embarque (before any deletes)
2. **Delete** related records (conceptos_venta, conceptos_costo, documentos, notas, facturas) — existing code
3. **Delete** the embarque — existing code
4. **Check** if `cotizacion_id` exists, count remaining embarques linked to it
5. **Update** cotización to `'Aceptada'` if count is 0

No other files need changes.

