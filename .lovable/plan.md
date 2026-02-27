

# Subtotal/Total con IVA y dropdown de conceptos marítimos en Step 4

## Archivo: `src/pages/NuevoEmbarque.tsx`

### 1. Estado funcional para conceptos de venta y costo
- Agregar estado `conceptosVenta` y `conceptosCosto` como arrays de objetos `{ concepto, cantidad, precioUnitario, moneda }`
- Calcular `total = cantidad * precioUnitario` por fila
- Calcular `subtotal` (suma de totales), `iva` (16%), y `totalConIva`

### 2. Dropdown de concepto en embarques marítimos
- En **Conceptos de Venta**: si `modo === 'Marítimo'`, reemplazar el Input de "Concepto" por un `<Select>` con opciones: "Flete marítimo" y "Revalidación"
- En **Conceptos de Costo**: igual, reemplazar el Input de "Concepto" por un `<Select>` con las mismas opciones cuando sea marítimo
- Para otros modos, mantener el Input de texto libre

### 3. Mostrar Subtotal y Total con IVA
- Debajo de la tabla de Conceptos de Venta, agregar:
  - **Subtotal (Sin IVA):** suma de totales de venta
  - **IVA (16%):** subtotal × 0.16
  - **Total (Con IVA):** subtotal + IVA
- Mostrar formateados con símbolo de moneda

### 4. Botones funcionales de agregar/eliminar
- "+ Agregar concepto" y "+ Agregar costo" agregan filas al array correspondiente
- Cada fila con botón de eliminar

