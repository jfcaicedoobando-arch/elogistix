

## Recomendación: Agrupación de embarques por BL Master

### 1. Estructura en la base de datos

No se necesita una tabla nueva. La tabla `embarques` ya tiene la columna `bl_master`. La lógica es:

- Al crear un embarque, si el operador ingresa un BL Master que ya existe en otro embarque, se reutiliza el mismo `expediente` (referencia Elogistix) de ese embarque existente.
- Si el BL Master es nuevo o está vacío, se genera un nuevo expediente con `generar_expediente()`.

Esto significa que **varios registros en `embarques` pueden compartir el mismo valor de `expediente`**. Actualmente `expediente` no tiene restricción `UNIQUE`, así que esto ya es compatible.

**Cambio recomendado en BD**: Crear una función RPC `resolver_expediente_por_bl(bl_master text, tipo_op text)` que:
1. Busca en `embarques` si existe algún registro con ese `bl_master`
2. Si existe → devuelve su `expediente`
3. Si no existe → llama a `generar_expediente(tipo_op)` y devuelve el nuevo

Esto mantiene la atomicidad en el servidor y evita race conditions.

### 2. Cambios en el flujo de creación (`NuevoEmbarque.tsx`)

En `handleFinish`, reemplazar la llamada directa a `generar_expediente` por la nueva función `resolver_expediente_por_bl`:
- Si `form.blMaster` tiene valor → llamar `resolver_expediente_por_bl(bl_master, tipo_op)`
- Si `form.blMaster` está vacío → llamar `generar_expediente(tipo_op)` como hasta ahora

No se toca ningún otro campo del formulario.

### 3. Lista de embarques (`Embarques.tsx`)

Agregar una columna **BL Master** a la tabla. Los embarques que comparten el mismo BL Master se pueden identificar visualmente con un icono o badge de agrupación (ej: un icono de enlace 🔗). Agregar el BL Master al filtro de búsqueda.

### 4. Detalle del embarque (`EmbarqueDetalle.tsx` / `TabResumen.tsx`)

Agregar una sección **"Embarques relacionados"** que:
- Consulta `embarques` donde `bl_master = embarque.bl_master AND id != embarque.id`
- Muestra una tabla compacta: Expediente (compartido), BL House, Cliente, Shipper, Estado
- Cada fila es clickeable para navegar al detalle de ese embarque
- Solo se muestra si `bl_master` tiene valor y hay más de 0 relacionados

### 5. Impacto en costos, facturación y reportes

**Costos**: Cada embarque mantiene sus propios conceptos de costo y venta. No cambia nada en la estructura. Si en el futuro se requiere prorratear costos compartidos (ej: flete marítimo del BL Master entre todos los BL House), sería una mejora posterior.

**Facturación**: Cada embarque se factura de forma independiente a su propio cliente. Sin cambios.

**Reportes**: Los reportes actuales operan por embarque individual. Si se desea un reporte de rentabilidad agrupado por BL Master, sería una mejora posterior que agrupe por el campo `bl_master`.

**En resumen**: la estructura actual de costos/facturación/reportes no requiere cambios. Cada embarque sigue siendo una entidad independiente con su propio cliente, costos y facturas. La agrupación por BL Master es solo visual y de referencia.

### Resumen de cambios

```text
┌─────────────────────────────────────────────┐
│ BD: Nueva función resolver_expediente_por_bl│
│     (busca BL existente o genera nuevo)     │
├─────────────────────────────────────────────┤
│ NuevoEmbarque.tsx: usar nueva función RPC   │
├─────────────────────────────────────────────┤
│ Embarques.tsx: columna BL Master + búsqueda │
├─────────────────────────────────────────────┤
│ TabResumen.tsx: sección embarques relaciona-│
│ dos (query por bl_master compartido)        │
├─────────────────────────────────────────────┤
│ Changelog.tsx: nueva entrada                │
└─────────────────────────────────────────────┘
```

