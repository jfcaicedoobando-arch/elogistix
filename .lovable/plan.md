

## Plan: Actualizar catálogos de conceptos USD y MXN

### Archivo: `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`

Reemplazar líneas 11-12 con los nuevos catálogos:

```ts
const CONCEPTOS_USD = ['Cargos en Origen', 'Costos Portuarios', 'Consolidación', 'Seguro', 'Recolección', 'Modificación de BL', 'Flete Marítimo', 'Flete Aéreo', 'Flete Terrestre', 'Handling', 'Desconsolidación', 'Revalidación', 'Demoras', 'Cargos en Destino', 'Release', 'Otro'];
const CONCEPTOS_MXN = ['Entrega Nacional', 'Honorarios de Despacho Aduanal', 'Otro'];
```

### Archivo: `src/pages/Changelog.tsx`

Entrada v4.10.4 — "Actualizar catálogos de conceptos USD y MXN en Costos & P&L".

