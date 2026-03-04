

## Plan: Expediente = Referencia Elogistix con formato automático

### Entendimiento

El **expediente** es el número de referencia de Elogistix. No son dos campos distintos. El campo `referencia_operacion` que agregamos antes es redundante y debe eliminarse de la UI y el formulario. El expediente se genera automáticamente con formato `EL[IMP|EXP][00001]`.

### Cambios

**1. Migración BD: Secuencia global + función generadora**
- Crear secuencia `embarque_consecutivo_seq` inicializada al conteo actual de embarques existentes
- Crear función SQL `generar_expediente(tipo_op text)` que retorna `'EL' || CASE ... || lpad(nextval, 5, '0')`
- Eliminar la columna `referencia_operacion` y `embarque_padre_id` de la tabla (ya no se necesitan)

**2. `src/hooks/useEmbarqueForm.ts`**
- Eliminar `referenciaOperacion` y `embarquePadreId` del estado del formulario y del payload

**3. `src/components/embarque/StepDatosGenerales.tsx`**
- Eliminar el campo "Referencia de Operación" y sus props

**4. `src/pages/NuevoEmbarque.tsx`**
- Reemplazar `generateExpediente()` (random) por llamada a `supabase.rpc('generar_expediente', { tipo_op: form.tipo })`

**5. `src/pages/Embarques.tsx`**
- Eliminar la columna "Ref. Operación" de la tabla
- Eliminar la búsqueda por `referencia_operacion`

**6. `src/components/embarque/TabResumen.tsx`**
- Eliminar la sección de "Operación" y embarques hermanos

**7. `src/pages/EmbarqueDetalle.tsx`**
- Eliminar el hook `useEmbarquesHermanos` y su paso a `TabResumen`

**8. `src/hooks/useEmbarques.ts`**
- Eliminar el hook `useEmbarquesHermanos`

**9. `src/pages/EditarEmbarque.tsx`**
- Eliminar props de `referenciaOperacion` del `StepDatosGenerales`

**10. `src/pages/Changelog.tsx`**
- Nueva entrada v4.5.0

### Resultado
- Expedientes con formato `ELIMP00001`, `ELEXP00002`, `ELIMP00003`
- Consecutivo global, atómico en BD, único e irrepetible
- No editable por el operador
- Sin campos redundantes en la UI

