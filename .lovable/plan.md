# Fix: doble toast al eliminar embarque

## Causa
Al eliminar un embarque se disparan **dos** notificaciones:

1. `useEliminarEmbarque` (`src/features/embarques/hooks/mutations/useDeleteEmbarque.ts`) — dispara `notifySuccess({ title: "Embarque eliminado" })` en `onSuccess` (y `notifyError` en `onError`).
2. `DialogEliminarEmbarque` (`src/features/embarques/components/DialogEliminarEmbarque.tsx`) — después de `await mutateAsync(...)` dispara otra vez `notifySuccess({ title: "Embarque eliminado", description: "${expediente} fue eliminado permanentemente." })` (y `notifyError` en el `catch`).

El único caller real de este hook es el dialog, así que hay duplicación garantizada.

## Fix (mínimo, solo presentación)
**`src/features/embarques/hooks/mutations/useDeleteEmbarque.ts`** — quitar los toasts del hook. El hook queda enfocado en su responsabilidad (mutación + invalidación de queries); el dialog conserva el mensaje enriquecido con `expediente`. Los tests del hook (`useMutationsEmbarque.test.tsx`) se ajustan si estaban verificando toasts.

Resultado:
- Éxito: 1 toast con el expediente.
- Error: 1 toast con el detalle real.

## Validación
- Verificar tests del hook (`bunx vitest run src/features/embarques/hooks/mutations/__tests__/useMutationsEmbarque.test.tsx`) y ajustarlos si asertaban toasts.
- Prueba manual en `/embarques/:id` → eliminar → confirmar un solo toast.

## Changelog
Bump patch `APP_VERSION` (13.213.14) + entrada en `CHANGELOG.md`.
