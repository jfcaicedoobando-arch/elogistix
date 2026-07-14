## Diagnóstico

En BD, ELIMP00281 tiene:
- Estado actual: **Entregado**
- Factura Comercial / Packing List: **No aplica** (satisfechos en la matriz de auditoría)
- BL Master y BL House: **Recibido con archivo**

Es decir, la RPC `auditoria_embarques_org` **hoy** ya no debería reportar `docs_faltantes` para ese embarque. Sin embargo, el card de auditoría muestra estado "Arribo" y como faltantes FC / PL / BL House — datos previos a que el operador marcara "No aplica" y subiera los BL.

**Causa raíz:** el reporte de auditoría está en caché de React Query (`staleTime: 5 min`) y **ninguna mutation** de embarques invalida esa key. Cuando el operador:

1. avanza el estado (Arribo → Entregado),
2. sube documentos,
3. marca documentos como "No aplica",

la vista `/auditoria` queda mirando el snapshot viejo hasta que el usuario presione **Recalcular** o pasen 5 min. Por eso el detalle muestra todo en verde pero la lista de hallazgos sigue reportando faltantes con el estado anterior.

Analogía: la página de auditoría es como un pizarrón con la foto de ayer; los cambios del día se hacen en la operación, pero nadie borra el pizarrón hasta que alguien lo pide manualmente.

## Alcance del fix (frontend puro, sin tocar SQL)

Invalidar `queryKeys.auditoria.embarques` en las mutations que cambian datos que la RPC evalúa. Con eso el reporte se refresca automáticamente y la contradicción desaparece.

### Archivos a modificar

1. **`src/features/embarques/hooks/mutations/useDocumentoEmbarqueMutations.ts`**
   Agregar `queryClient.invalidateQueries({ queryKey: queryKeys.auditoria.embarques })` en los `onSuccess` de:
   - `useUploadDocumentoEmbarque`
   - `useDeleteDocumentoEmbarque`
   - `useCreateDocumentoEmbarque`
   - `useSetDocumentoNoAplica`

2. **Mutation de avance de estado del embarque** (`avanzar_estado_embarque` / cierre). Localizar el hook (`useEmbarqueEstadoActions` / `useAvanzarEstadoEmbarque`) y agregar la misma invalidación en `onSuccess`. Aplicar también en la mutation de "cerrar embarque".

3. **`src/features/embarques/hooks/mutations/useCreateEmbarque.ts`** (y update de datos que afectan reglas: ETD/ETA, fecha_llegada_real, tipo_cambio). Agregar la invalidación en el `onSuccess` correspondiente.

4. **Facturación / conceptos_venta** (regla `ventas_sin_facturar`): invalidar auditoría al timbrar factura o cambiar `estado_facturacion`. Solo tocar los hooks ya existentes de fact./conceptos-venta que muten esos campos.

### Detalles técnicos

- Reusar `queryKeys.auditoria.embarques` desde `@/features/auditoria/queryKeys` para no romper la fuente única de la key.
- No cambiar `staleTime` del `useAuditoria`: mantiene el badge del sidebar barato.
- No tocar la RPC ni la matriz `_docs_requeridos_por_estado`.

### Verificación

- `bun run lint`
- Test unitario nuevo en `useDocumentoEmbarqueMutations` (mock de `queryClient.invalidateQueries`) asegurando que las 4 mutations invalidan `[auditoria, embarques]`.
- Prueba manual: subir un doc en un embarque, entrar a `/auditoria` sin recargar y ver el hallazgo desaparecer.

### Changelog

- Bump `APP_VERSION` a `13.300.20`.
- Entrada en `CHANGELOG.md`: "Auditoría: refresco automático al mutar documentos / estado / facturación de embarques."
