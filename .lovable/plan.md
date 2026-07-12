## Diagnóstico

CI del último run: **588 archivos de test / 4128 tests — todos pasan**. Lo único que rompe el pipeline es el umbral de cobertura de **branches**:

```
Statements : 39.48% (10071/25507)  ✓ (umbral 34)
Branches   : 33.93% (7166/21115)   ✗ (umbral 34) — faltan solo 14 branches
Functions  : 30.09%                ✓
Lines      : 39.95%                ✓
```

Necesitamos **+14 branches cubiertos** (0.07%) para pasar. La memoria prohíbe bajar el umbral, así que se escriben tests focalizados.

## Objetivo

Añadir tests que cubran ramas hoy no ejercidas en los archivos que más se movieron en las últimas migraciones TanStack. Con ~20 branches nuevos cubiertos dejamos margen (~34.03%) sin acercarnos al filo.

## Archivos objetivo (ricos en ramas sin cubrir)

1. **`src/hooks/shared/useMutationWithFeedback.ts`** — optimistic path recién añadido. Ramas sin tocar:
   - `silent: true` (no toast al éxito/error)
   - `optimisticUpdate` sin `snapshotKeys` (no rollback)
   - `onError` con rollback ejecutándose (fallback cuando la mutación rechaza)
   - `successMessage` como función vs string

2. **`src/features/embarques/queries.ts`** — factory `expedientesCliente` con `organizationId` **null/undefined**, y `proveedoresSelect` con `organizationId` **definido**. Hoy sólo se prueba un lado de cada `??`.

3. **`src/features/facturacion/hooks/useTimbrarFacturaDialog.ts`** — nuevo `onError` de `actualizarDatos`, rama de "envío deshabilitado", y precedencia `defaults ?? props ?? initial`.

4. **`src/features/embarques/hooks/useActualizarEta.ts`** y **`useActualizarFechaLlegadaReal.ts`** — migradas a optimista; agregar 1-2 tests que verifiquen rollback en error.

## Entregable

- 4 archivos de test nuevos/ampliados (~15-20 assertions, ~20-25 branches nuevos cubiertos).
- Correr `bun run test:coverage:shard` local sobre esos archivos y verificar que branches sube ≥ 34.1%.
- Actualizar `CHANGELOG.md` + `APP_VERSION` → `13.285.0`.
- Sin tocar código de producción; solo tests.

## Detalles técnicos

- Los mocks de Supabase siguen el patrón `_supabaseChainMock.ts` (regla `mem://technical/testing-mock-patterns`).
- Cleanup vía `afterEach` global (regla `mem://technical/testing-cleanup-protocol`).
- Cada test envuelto en `queryWrapper` para `useQuery`/`useMutation`.
- `notifyError` mockeado para verificar que `silent: true` **no** lo llama.

## Verificación final

1. `bunx vitest run <los 4 archivos>` → verde.
2. `bun run test:coverage:shard -- --shard=1/1 <archivos>` → confirma branches locales suben.
3. `bunx tsgo --noEmit` + `bun run lint` → limpio.

Si tras esto CI sigue por debajo del umbral, iterar con 1-2 archivos más (candidatos preparados: `useEnvioDocumentoForm`, `useIsDemoUser`).