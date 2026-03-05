

## Plan: Rediseñar NuevaCotizacion.tsx como wizard de 4 pasos

### Problema clave
`SeccionCostosInternosPL` requiere un `cotizacionId` para funcionar (consulta la BD). En una cotización nueva no existe ID aún. Se necesita crear un componente nuevo de costos que trabaje con estado local.

### Archivos a crear/modificar

**1. Nuevo: `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`**
- Versión local de SeccionCostosInternosPL que NO requiere cotizacionId
- Props: `filas`, `setFilas`, `conceptosUSD`, `conceptosMXN` (estado local del wizard)
- Misma UI (tablas USD/MXN, resumen P&L, badges de profit)
- Agrega columnas Unidad de Medida y Precio Venta editables
- Badge de rentabilidad: Verde (USD>15% Y MXN>10%), Amarillo (0-15%), Rojo (negativo)
- No tiene botón "Guardar" propio (se guarda al final del wizard)

**2. Modificar: `src/pages/NuevaCotizacion.tsx`**
- Reorganizar como wizard siguiendo patrón de NuevoEmbarque.tsx

**Estado nuevo:**
```
currentStep, numContenedores, costosInternos (filas locales), costosPreLlenados
```

**Layout:**
- Header fijo: título + StepIndicator (4 pasos)
- Centro scrolleable max-w-4xl
- Footer: Anterior/Siguiente/Guardar

**Paso 1 — Datos Generales:**
- SeccionDestinatario, SeccionDatosGeneralesCotizacion, Mercancía (FCL/LCL/Aéreo), SeccionRutaCotizacion
- Card nuevo "Número de Embarques" (input numContenedores, min=1)
- Card "Notas Adicionales"

**Paso 2 — Costos & P&L:**
- SeccionCostosInternosPLLocal con estado local
- Pre-pobla filas desde catálogo vacío (concepto vacío, costo=0, precio_venta=0)
- Badge de rentabilidad global

**Paso 3 — Cotización Cliente:**
- SeccionConceptosVentaCotizacion existente
- Al entrar por primera vez: pre-llena conceptosUSD/MXN desde costosInternos (concepto→descripcion, precio_venta→precio_unitario, etc.)
- Nota informativa "Pre-llenado desde Costos & P&L"

**Paso 4 — Resumen:**
- Card P&L USD y MXN con totales
- Card datos operación (cliente, ruta, num contenedores, modo, incoterm)
- Nota "La cotización se guardará en estado Borrador"

**Navegación:**
- Anterior (disabled en paso 1) / Siguiente (pasos 1-3)
- "Guardar Cotización" en paso 4: ejecuta handleGuardar existente + upsertCotizacionCostos + incluye num_contenedores

**3. Modificar: `src/pages/Changelog.tsx`** — entrada v4.10.0

### Interfaz de filas locales para costos
```ts
interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
}
```

