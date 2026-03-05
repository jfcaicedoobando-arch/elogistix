

## Plan: Actualizar catálogos y lógica de IVA en Cotización Cliente

### Archivo: `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`

**1. Reemplazar catálogos (líneas 11-24):**

```ts
const CATALOGO_USD = [
  'Cargos en Origen', 'Costos Portuarios', 'Consolidación', 'Seguro',
  'Recolección', 'Modificación de BL', 'Flete Marítimo', 'Flete Aéreo',
  'Flete Terrestre', 'Handling', 'Desconsolidación', 'Revalidación',
  'Demoras', 'Cargos en Destino', 'Release', 'Otro'
];

const CATALOGO_MXN = ['Entrega Nacional', 'Honorarios de Despacho Aduanal', 'Otro'];

const CONCEPTOS_CON_IVA = ['Handling', 'Desconsolidación', 'Revalidación', 'Demoras', 'Cargos en Destino', 'Release'];
```

**2. Auto-activar IVA al seleccionar concepto USD (línea ~99-105):**

En el `onValueChange` del Select USD, después de setear `descripcion`, también setear `aplica_iva` según si el concepto está en `CONCEPTOS_CON_IVA`:

```ts
onValueChange={val => {
  if (val === 'Otro') {
    actualizarConceptoUSD(i, 'descripcion', '');
    actualizarConceptoUSD(i, 'aplica_iva', false);
    setTimeout(() => actualizarConceptoUSD(i, '_esOtro', true), 0);
  } else {
    actualizarConceptoUSD(i, 'descripcion', val);
    actualizarConceptoUSD(i, 'aplica_iva', CONCEPTOS_CON_IVA.includes(val));
  }
}}
```

**3. MXN sin cambios de lógica** — ya aplica IVA 16% obligatorio a todos.

### Archivo: `src/pages/Changelog.tsx` — entrada v4.10.5

