## Problema

Al capturar una factura de proveedor que además **vincula conceptos** o **crea concepto ad-hoc en embarque**, aparecen 2 toasts encimados:

1. `"N concepto(s) marcados como pagados"` o `"Concepto creado en embarque X"` — emitido por `vincularSafe` en `useNuevaFacturaProveedorForm.sideEffects.ts`.
2. `"Factura de proveedor capturada"` — emitido al final de `submit` en `useNuevaFacturaProveedorForm.ts`.

Es lo que vio Karol. La analogía: el cajero le da 2 recibos por la misma compra —uno por el producto y otro por el cambio— cuando basta con uno que diga ambas cosas.

## Solución

Consolidar en **un solo toast final** con descripción enriquecida. Los warnings de fallos parciales (XML falló, vínculo falló) sí siguen siendo toasts independientes porque son condiciones de error de una operación que sí tuvo éxito parcial.

## Cambios

### 1. `src/features/cxp/hooks/useNuevaFacturaProveedorForm.sideEffects.ts`
- `vincularSafe` deja de emitir `toast.success` y en su lugar **retorna** un objeto `{ liquidados?: number; conceptoAdHocExpediente?: string }`.
- `uploadCfdiSafe` mantiene su toast.warning (es de error parcial). No emite success (nunca lo hizo).
- Los `toast.warning(...)` de fallos parciales se mantienen sin cambios.

### 2. `src/features/cxp/hooks/useNuevaFacturaProveedorForm.ts` (submit)
- Recibir el retorno de `vincularSafe`.
- Reemplazar `toast.success("Factura de proveedor capturada")` por:
  ```ts
  toast.success("Factura de proveedor capturada", {
    description: buildDescription(sideResult), // ej. "1 concepto marcado como pagado" o "Concepto creado en embarque LC-1234" o undefined
  });
  ```

### 3. Tests
- Ajustar cualquier test que dependa del texto de los toasts en sideEffects (si existe). Verificar `useNuevaFacturaProveedorForm` tests.

### 4. Versionado
- `APP_VERSION` → `13.219.1`.
- `CHANGELOG.md`: nueva entrada bugfix "Doble toast al capturar factura de proveedor con vínculos (reportado por Karol)".

## Fuera de alcance
- Los toasts de éxito en `DialogRegistrarPagoProveedor`, `CrearProveedorDesdeCfdiDialog`, `useCargaCfdi` (CFDI procesado) — son flujos independientes y no forman parte del bug reportado.
