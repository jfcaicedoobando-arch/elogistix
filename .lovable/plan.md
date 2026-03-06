

## Plan: Permitir decimales en el campo Cantidad del P&L

### Problema
El campo "Cant." en `SeccionCostosInternosPLLocal.tsx` (línea 149) usa `replace(/[^0-9]/g, '')` que elimina puntos y comas, impidiendo ingresar cantidades decimales como `1.5`.

### Solución
En `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`:

1. **Línea 145**: Cambiar `inputMode="numeric"` → `inputMode="decimal"` para mostrar teclado con punto decimal en móvil.
2. **Línea 149**: Cambiar el regex de `[^0-9]` a `[^0-9.]` para permitir punto decimal, y usar `parseFloat` en lugar de `parseInt`.
3. **Línea 152 (onBlur)**: Cambiar default de `1` a `1` pero mantener consistencia con parseFloat.

Cambio concreto en el bloque de cantidad (~líneas 144-154):
```tsx
<Input
  type="text" inputMode="decimal"
  value={fila.cantidad === 0 ? '' : fila.cantidad}
  onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
  onChange={e => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    updateFila(gi, "cantidad", raw === '' ? 0 : parseFloat(raw));
  }}
  onBlur={e => { if (e.target.value === '') updateFila(gi, "cantidad", 1); }}
  className="h-8 text-sm text-right w-[80px]"
/>
```

### `src/pages/Changelog.tsx`
Entrada v4.15.6: "Campo de cantidad en P&L ahora acepta valores decimales."

