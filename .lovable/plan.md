

## Diagnóstico: Campo "Total" no permite ingresar números

### Causa identificada

El campo "Total" en ambas secciones (costos y venta) tiene el atributo `readOnly`, lo que impide la escritura. Esto es **intencional** porque el Total se calcula automáticamente:

- **Costos**: `monto + (aplicaIva ? monto * 0.16 : 0)`
- **Venta**: `(cantidad * precioUnitario) + (aplicaIva ? cantidad * precioUnitario * 0.16 : 0)`

Línea 69:
```tsx
<Input readOnly value={`$${(costo.monto + (costo.aplicaIva ? costo.monto * 0.16 : 0)).toFixed(2)}`} className="text-sm bg-muted" />
```

Línea 108:
```tsx
<Input readOnly value={`$${((venta.cantidad * venta.precioUnitario) + ...}).toFixed(2)}`} className="text-sm bg-muted" />
```

### Corrección propuesta

Reemplazar los `<Input readOnly>` por un `<span>` con estilo similar, para que visualmente sea claro que es un valor calculado y no un campo editable. Esto elimina la confusión de ver un input que no responde.

#### Archivo: `src/components/embarque/StepCostosPrecios.tsx`
- Línea 69: cambiar `<Input readOnly ...>` por `<span className="text-sm bg-muted rounded-md border px-3 py-2 flex items-center">$...</span>`
- Línea 108: mismo cambio para la sección de venta

#### Archivo: `src/pages/Changelog.tsx`
- Entrada v3.13.4

### Archivos a modificar
- `src/components/embarque/StepCostosPrecios.tsx`
- `src/pages/Changelog.tsx`

