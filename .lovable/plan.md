## Diagnóstico

El botón "Confirmar y Generar" del diálogo de proforma (embarque → tab Facturación) **sí ejecuta su handler**, pero el `handleConfirmar` en `useDialogGenerarProformaController.ts` (líneas 132–144) tiene un `catch { }` vacío. Cuando algo falla **antes** del `mutateAsync` (típicamente la validación FCL de peso/volumen de contenedores en `validarContenedoresFCL`) o **después** (la generación del PDF), la promesa se cae silenciosamente y al usuario le parece que el botón "no hace nada".

Analogía: es como apretar el botón del elevador y que internamente suene una alarma — pero los altavoces están apagados, así que nadie se entera de por qué no se mueve.

Los errores del propio RPC `crearProforma` sí muestran toast (vía `onError` del hook), pero los otros dos casos no.

## Causa más probable para Alan

Su embarque tiene contenedores FCL marítimos sin peso o volumen capturados. `validarContenedoresFCL` lanza `Error("Captura peso y volumen…")` antes de llegar al RPC. El `catch {}` se lo come y el dialog queda abierto sin ninguna pista visual.

## Cambios propuestos

1. **`src/features/embarques/hooks/useDialogGenerarProformaController.ts`** (`handleConfirmar`):
   - Cambiar `catch { }` por `catch (err) { ... }` que:
     - Muestre un `toast.error` con el mensaje del `Error` (fallback genérico si no es `Error`).
     - Reporte a Sentry con `tags: { feature: "proforma_generate" }` SOLO si NO es un error de validación esperado (los de validación FCL no son bugs).
   - No cerrar el diálogo cuando falla (comportamiento ya correcto, se mantiene).
   - Importar `toast` desde `@/hooks/shared` y `captureException` lazy.

2. **`src/features/embarques/services/submitProformaDialog.ts`**:
   - Marcar el `Error` lanzado por la validación FCL con una flag (`(err as any).isValidation = true`) o usar una subclase `ProformaValidationError` para diferenciarlo de errores reales. Preferencia: subclase exportada `ProformaValidationError extends Error` (más limpia, testeable).
   - Aplicar la misma subclase a futuros pre-checks.

3. **`src/features/embarques/hooks/__tests__/useDialogGenerarProformaController.test.tsx`**:
   - Añadir test: cuando `submitProformaDialog` rechaza con `ProformaValidationError`, se llama `toast.error` con el mensaje y NO se llama a `captureException`.
   - Añadir test: cuando rechaza con `Error` genérico (ej. fallo del PDF), se llama `toast.error` y SÍ `captureException`.

4. **`src/constants/appVersion.ts`** → `13.67.9`.

5. **`CHANGELOG.md`** → entrada `[13.67.9]` describiendo que el botón ahora muestra feedback en lugar de fallar silenciosamente.

## Fuera de alcance

- No cambiar la lógica de validación FCL en sí (sigue exigiendo peso y volumen).
- No cambiar el RPC ni la generación del PDF.
- No tocar UI del diálogo (sólo se añade un toast).
