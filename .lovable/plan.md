## Problema

Cuando un toast de Sonner aparece encima de un modal y el usuario hace clic en él (para cerrarlo o usar su acción), Radix Dialog interpreta ese clic como "clic fuera" y cierra el modal. Los toasts se renderizan en un portal hermano al del Dialog, así que técnicamente están fuera del `DialogContent`.

## Causa (analogía)

Imagina el modal como una habitación con guardia: si tocas algo que no sea la habitación, el guardia cierra la puerta. El toast es un post-it flotando en el pasillo — al tocarlo, el guardia cree que tocaste el pasillo y cierra.

## Solución

Interceptar `onPointerDownOutside` y `onInteractOutside` en `DialogContent` (y `AlertDialogContent`) para ignorar eventos cuyo `target` esté dentro de `[data-sonner-toaster]`. Es un fix global, una sola línea de lógica, aplica a todos los modales del sistema sin tocar cada uno.

## Cambios

1. **`src/components/ui/dialog.tsx`** — En `DialogContent`, agregar handlers por defecto que:
   - Detectan si `event.target` (o su ancestro) tiene `[data-sonner-toaster]`.
   - Si sí, llaman `event.preventDefault()` para que Radix no cierre el modal.
   - Se permite override si el consumidor pasa sus propios handlers.

2. **`src/components/ui/alert-dialog.tsx`** — Mismo patrón en `AlertDialogContent` (confirmaciones, DoubleConfirmDeleteDialog, etc.).

3. **`CHANGELOG.md` + `APP_VERSION`** → `13.303.88`, bullet breve.

## Verificación

- Test manual en preview: abrir cualquier modal (ej. crear factura de proveedor), disparar un toast de error, hacer clic en la X del toast — el modal debe seguir abierto.
- Correr `bunx vitest run` en pruebas de arquitectura para asegurar que no rompe guardrails.

## Fuera de alcance

- No cambio la lógica de toasts ni de modales individuales.
- No modifico Sonner ni su Toaster (ya se ajustó en v13.303.72).
