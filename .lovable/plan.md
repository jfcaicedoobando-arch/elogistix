

## Cambio: Quitar flechas del campo numérico "Valor de mercancía (USD)"

### Archivos a modificar

**`src/components/cotizacion/SeccionRutaCotizacion.tsx`** (línea 153)
- Cambiar el `<Input type="number">` a `type="text"` con `inputMode="decimal"` y `pattern` para aceptar solo números decimales
- Filtrar la entrada para permitir solo dígitos y punto decimal en el `onChange`

**`src/pages/Changelog.tsx`**
- Nueva entrada v4.2.4 documentando el cambio

