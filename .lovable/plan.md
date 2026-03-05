

## Plan: Agregar "Cargos en Destino" al catálogo USD

### Cambio único

**`src/components/cotizacion/SeccionCostosInternosPLLocal.tsx` (línea 11)**

Agregar `'Cargos en Destino'` al array `CONCEPTOS_USD`, quedando:

```ts
const CONCEPTOS_USD = ['Flete Marítimo', 'Flete Aéreo', 'Embalaje', 'Coordinación de Recolección', 'Seguro de Carga', 'Cargos en Origen', 'Cargos en Destino', 'Handling', 'Desconsolidación', 'Revalidación', 'Otro'];
```

**`src/pages/Changelog.tsx`** — entrada v4.10.3

