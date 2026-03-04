

## Recomendación de estructura

La buena noticia es que **la base de datos ya tiene todo implementado**:

- Función `generar_expediente(tipo_op text)` que produce exactamente el formato `EL[TIPO][CONSECUTIVO]`
- Secuencia `embarque_consecutivo_seq` que garantiza consecutivos únicos y globales
- Soporta: Importación→IMP, Exportación→EXP, Nacional→NAC

**El problema actual**: `NuevoEmbarque.tsx` **no usa** esa función. En su lugar genera un código aleatorio del lado del cliente (`EXP-2026-XXXX`), que no es secuencial ni sigue el formato requerido.

### Solución: un solo cambio en un solo archivo

**`src/pages/NuevoEmbarque.tsx`**
- Eliminar la función local `generateExpediente()`
- Reemplazar por una llamada RPC a la función de base de datos:
  ```ts
  const { data: expediente } = await supabase.rpc('generar_expediente', { tipo_op: form.tipo });
  ```
- Importar `supabase` desde `@/integrations/supabase/client`

**`src/pages/Changelog.tsx`**
- Nueva entrada v4.3.5

### Lo que NO se toca
- Ningún campo del formulario
- Ningún otro módulo
- La lista y detalle de embarques ya muestran el campo `expediente` tal cual viene de la BD, así que mostrarán el nuevo formato automáticamente
- No se necesitan cambios en la base de datos

