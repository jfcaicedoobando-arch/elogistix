

## Fix: Add cotizaciones cache invalidation to useEliminarEmbarque

### Change: `src/hooks/useEmbarqueMutations.ts`

In the `onSuccess` callback of `useEliminarEmbarque`, add `queryClient.invalidateQueries({ queryKey: queryKeys.cotizaciones.all })` after the existing embarques invalidation. This ensures the cotizaciones list reflects the updated estado when a linked embarque is deleted.

