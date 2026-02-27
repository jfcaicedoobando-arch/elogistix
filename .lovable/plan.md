

# Wizard de 2 pasos para Nuevo Cliente con documentos obligatorios

## Archivo a modificar: `src/pages/Clientes.tsx`

### Cambios
- Agregar estado `step` (1 o 2) y `documentos` (array de `{ nombre: string, adjuntado: boolean }`)
- **Paso 1:** Formulario actual (datos generales). Botón "Siguiente" en vez de "Guardar" (valida nombre, RFC, CP)
- **Paso 2:** Lista de 10 documentos obligatorios con botón de adjuntar archivo para cada uno:
  1. CIF
  2. Opinión fiscal
  3. Acta constitutiva
  4. INE RL
  5. Poder notarial
  6. Comprobante de domicilio
  7. Datos bancarios
  8. Opinión de cumplimiento IMSS/Infonavit
  9. Contrato de servicios con Elogistix
  10. Estados financieros último corte
- Cada documento muestra: nombre + botón "Adjuntar" (input file) + ícono check si adjuntado
- Botón "Crear" deshabilitado hasta que **todos** los documentos estén adjuntados
- Botón "Atrás" para volver al paso 1
- Al cerrar o crear, resetear step a 1 y limpiar documentos
- Los archivos se guardan solo como nombre de referencia en memoria (sin backend)

### Referencia de patrón
Se seguirá el mismo patrón usado en `NuevoProveedorDialog.tsx` para el wizard de 2 pasos con documentos.

