

## Plan: Corregir error UUID vacío al crear embarque

### Problema
El error `"invalid input syntax for type uuid: \"\""` ocurre porque `cliente_id` se envía como cadena vacía cuando el usuario no selecciona un cliente. Postgres rechaza `""` para columnas de tipo UUID.

### Cambios

**1. `src/pages/NuevoEmbarque.tsx`**
- Agregar validación en `handleFinish`: si `form.clienteId` está vacío, mostrar toast de error y no continuar
- Validar también campos mínimos requeridos: `modo`, `tipo`

**2. `src/hooks/useEmbarqueForm.ts`**
- En `buildEmbarquePayload` línea 139: cambiar `cliente_id: form.clienteId` a `cliente_id: form.clienteId || null` para evitar enviar cadena vacía
- En `buildConceptosCostoPayload`: asegurar que `proveedor_id` vacío se convierta a `null`

**3. `src/pages/Changelog.tsx`**
- Nueva entrada v4.3.4 documentando la corrección

### Resultado
- El usuario ve un mensaje claro si intenta crear un embarque sin seleccionar cliente
- Los campos UUID opcionales envían `null` en lugar de `""`, evitando el error de Postgres

