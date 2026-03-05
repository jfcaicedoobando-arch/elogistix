

## Plan: Corregir input de precio unitario USD en conceptos de cotización

### Problema
El campo "P. Unitario (USD)" en la sección de conceptos de venta:
1. No borra el `0` inicial al hacer clic — el usuario escribe "1500" y queda "01500"
2. El valor se parsea incorrectamente por el prefijo "0"

### Solución
Cambiar los inputs numéricos de `precio_unitario` (y `cantidad`) en `SeccionConceptosVentaCotizacion.tsx` para que:
- Usen `type="text"` con `inputMode="decimal"` en lugar de `type="number"`
- Al recibir foco (`onFocus`), si el valor es `0`, limpiar el campo
- Al perder foco (`onBlur`), si el campo está vacío, restaurar a `0`
- Parsear correctamente el valor ingresado eliminando caracteres no numéricos

### Archivos a modificar

**1. `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`**
- Reemplazar los `<Input type="number">` de `precio_unitario` en ambas tablas (USD y MXN) por inputs de texto con manejo de foco
- Aplicar la misma lógica a los campos de `cantidad`

**2. `src/pages/Changelog.tsx`**
- Entrada v4.9.2

### Detalle técnico
```tsx
// Antes:
<Input type="number" min={0} step={0.01} value={c.precio_unitario} 
  onChange={e => actualizarConceptoUSD(i, 'precio_unitario', Number(e.target.value))} />

// Después:
<Input 
  type="text" inputMode="decimal"
  value={c.precio_unitario === 0 ? '' : c.precio_unitario}
  onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
  onChange={e => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    actualizarConceptoUSD(i, 'precio_unitario', raw === '' ? 0 : parseFloat(raw));
  }}
  onBlur={e => { if (e.target.value === '') actualizarConceptoUSD(i, 'precio_unitario', 0); }}
  placeholder="0.00"
/>
```

Se aplicará el mismo patrón a todos los campos numéricos editables de ambas tablas (USD y MXN).

