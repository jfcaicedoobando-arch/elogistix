

## Plan: Actualizar catálogos de conceptos en Costos & P&L

### Archivo: `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`

Reemplazar las líneas 11-12 (arrays `CONCEPTOS_USD` y `CONCEPTOS_MXN`) con:

```ts
const CONCEPTOS_USD = [
  'Cargos en Origen', 'Costos Portuarios', 'Consolidación', 'Seguro',
  'Recolección', 'Modificación de BL', 'Flete Marítimo', 'Flete Aéreo',
  'Flete Terrestre', 'Handling', 'Desconsolidación', 'Revalidación',
  'Demoras', 'Cargos en Destino', 'Release', 'Otro'
];
const CONCEPTOS_MXN = ['Entrega Nacional', 'Honorarios de Despacho Aduanal', 'Otro'];
```

La lógica de IVA opcional (Handling, Desconsolidación, Revalidación) no requiere cambios.

### Archivo: `src/pages/Changelog.tsx` — entrada v4.10.4

