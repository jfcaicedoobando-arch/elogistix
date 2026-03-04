

## Plan: Agregar conceptos al catálogo de dropdowns

### Archivo: `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`

Agregar los 4 nuevos conceptos a ambos catálogos (antes de 'Otro'):

```typescript
const CATALOGO_USD = [
  'Flete Marítimo', 'Flete Aéreo', 'Embalaje',
  'Coordinación de Recolección', 'Seguro de Carga',
  'Cargos en Origen', 'Revalidación', 'Handling',
  'Desconsolidación', 'Entrega Nacional', 'Otro',
];

const CATALOGO_MXN = [
  'Manejo', 'Demoras', 'Cargos en Destino',
  'Almacenaje', 'Entrega', 'Revalidación', 'Handling',
  'Desconsolidación', 'Entrega Nacional', 'Otro',
];
```

### Archivo: `src/pages/Changelog.tsx` — nueva entrada v4.8.1

