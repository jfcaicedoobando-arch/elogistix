

## Plan: Usar expediente del origen al duplicar

### Cambio único en `src/hooks/useEmbarques.ts`

En el loop de `useDuplicarEmbarque` (líneas 257-262), reemplazar la llamada a `supabase.rpc('generar_expediente')` por usar directamente `embarqueOrigen.expediente`:

- **Eliminar** líneas 258-262 (la llamada RPC y el manejo de error)
- **Cambiar** línea 268 `expediente: expediente as string` → `expediente: embarqueOrigen.expediente`
- En el push final al array `creados`, usar `embarqueOrigen.expediente` en lugar de `expediente as string`

### Cambio en `src/pages/Changelog.tsx`

Entrada v4.15.1 — "Duplicar embarque ahora conserva el mismo expediente del origen"

