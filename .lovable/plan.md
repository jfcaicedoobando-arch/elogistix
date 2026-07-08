# Fix: doble toast al registrar factura de proveedor

## Causa

Al capturar una factura de proveedor se emiten **dos** toasts de éxito distintos:

1. `src/features/cxp/hooks/useFacturaProveedorMutations.ts` → `useCrearFacturaProveedor.onSuccess` dispara `notifySuccess("Factura de proveedor creada")` en cuanto la fila entra a BD.
2. `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts` (línea 183) dispara `toast.success("Factura de proveedor capturada")` al terminar el flujo completo (insert + subida de XML/PDF a storage + vínculo a embarque/conceptos).

El del formulario es el correcto: aparece hasta que todos los efectos secundarios corren, y su texto ("capturada") coincide con lo que espera Karol. El de la mutation es prematuro y sobra.

## Cambio

Archivo: `src/features/cxp/hooks/useFacturaProveedorMutations.ts`

- En `useCrearFacturaProveedor`, quitar el `notifySuccess(...)` de `onSuccess`. Se mantiene la invalidación de queries (`qc.invalidateQueries`) y el `onError` intacto.
- El toast único de éxito lo seguirá emitiendo `useNuevaFacturaProveedorForm.submit` al final del flujo.

No se toca:
- `useEliminarFacturaProveedor` ni `useActualizarFacturaProveedor` (esos sí son la única vía y su toast debe quedarse).
- El hook `useNuevaFacturaProveedorForm` ni sus side effects (los toasts amarillos de "guardada pero XML falló" siguen funcionando cuando aplica).

## Verificación

- Correr `bunx vitest run src/features/cxp/hooks/__tests__/useNuevaFacturaProveedorForm.test.tsx` — sigue esperando `toast.success` una sola vez.
- Revisar si algún otro test (`useFacturaProveedorMutations`) asertaba el `notifySuccess` de creación; ajustarlo si aplica.

## Versionado

- Bump `APP_VERSION` a `13.218.2` (patch).
- Entrada en `CHANGELOG.md` describiendo el fix.

## Analogía

Es como si el cajero de un banco dijera "recibí tu depósito" al meter el dinero al cajón, y luego el sistema volviera a decir "depósito completado" cuando terminó de imprimir el comprobante. Los dos avisos hablan del mismo momento, pero solo el segundo es el que confirma que ya está todo listo — el primero sobra y confunde.
