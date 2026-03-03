

## Plan: Auto-mapeo de conceptos al convertir cotización en embarque

### Problema actual
Cuando una cotización se convierte en embarque (`useCrearEmbarqueDesdeCotizacion`), se crean los `conceptos_venta` correctamente en la BD, pero:
1. No se pre-crean filas de `conceptos_costo` — el operador tiene que agregar cada concepto desde cero
2. Si el operador abre el embarque para editar, los conceptos de venta ya están ahí, pero los costos están vacíos

### Solución
Modificar la función `useCrearEmbarqueDesdeCotizacion` para que **también cree automáticamente filas de `conceptos_costo`** usando los mismos conceptos del catálogo que vienen de la cotización, con montos en $0 para que el operador solo tenga que:
- Asignar proveedor
- Capturar el monto

Esto significa que si la cotización tiene 3 conceptos de venta (ej: Flete Marítimo, Manejo, Seguro de Carga), al crear el embarque se generan automáticamente 3 filas de costo con esos mismos nombres de concepto, moneda heredada, y monto en 0.

### Archivos a modificar

**`src/hooks/useCotizaciones.ts`** — `useCrearEmbarqueDesdeCotizacion`
- Después de insertar `conceptos_venta`, insertar también `conceptos_costo` con:
  - `concepto`: mismo valor de `descripcion` de cada concepto de venta
  - `moneda`: heredada de la cotización
  - `monto`: 0 (para que el operador lo llene)
  - `proveedor_id`: null
  - `proveedor_nombre`: '' (vacío)

**`src/pages/Changelog.tsx`**
- Nueva entrada v4.2.2 documentando el cambio

### Resultado esperado
Al confirmar una cotización → embarque:
- Los conceptos de venta quedan pre-llenados (ya funciona)
- Los conceptos de costo se pre-crean con los mismos conceptos, listos para que el operador solo asigne proveedor y monto
- No se modifica ningún otro formulario ni módulo

