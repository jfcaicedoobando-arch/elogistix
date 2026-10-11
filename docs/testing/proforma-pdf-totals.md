# Totales visibles del PDF de proformas

El PDF generado en cliente comparte el contrato de presentación de detalle,
listado y CSV: `calcularTotalesProformaConRespaldo` en
`src/features/proformas/domain/proformaListado.ts`.

Con desglose, `calcularTotalesProforma` aplica BL-12: producto decimal redondeado
por línea, IVA sobre esa base y suma de importes redondeados por moneda. No suma
ni convierte nominales USD/MXN entre sí. Filas, subtotales por contenedor y caja
final deben usar las mismas primitivas de `financialUtils`.

En proformas consolidadas la fuente es el snapshot
`proforma_conceptos_consolidados`. Su campo persistido `total` no identifica de
forma fiable un total con IVA: `supabase/schema/proformas/consolidar_proformas.sql`
lo escribe como base. El PDF deriva base, IVA y total del snapshot usando el
mismo dominio que la UI, sin cambiar el snapshot ni la cabecera. La tasa recibida
por el generador se propaga a ambas variantes del documento.

Sin desglose se conservan los seis importes guardados, redondeados mediante el
respaldo existente; no se reconstruye el total ni se infiere una conversión. El
PDF identifica ese respaldo con «Detalle de conceptos no disponible. Se conserva
el importe guardado». Una consolidada sin snapshot conserva su identidad.

Esto es paridad de presentación con la UI, no una conciliación fiscal ni una
reparación histórica. Algunas cabeceras históricas pueden contener un equivalente
MXN de conceptos USD además del importe USD. Este cambio no reescribe cabeceras,
reglas de conversión, facturas, SQL ni documentos de FacturAPI.

## Regresiones

- `src/pdf/documents/__tests__/proformaTotalesCanonicos.test.tsx`: redondeo por
  línea, monedas separadas, tratamientos/tasas, respaldo y cantidades fraccionarias.
- `src/pdf/documents/__tests__/proformaConsolidadaTotales.test.tsx`: snapshot,
  filas y grupos con IVA, tasa recibida, respaldo y aviso sólo con IVA efectivo.
- `src/generators/__tests__/commercialPdfIdentity.test.tsx`: tasa e identidad de
  consolidada incluso sin snapshot, junto con los guards de organización existentes.
- `tests/pdf/proformaTotalesCanonicos.test.tsx`: cuatro documentos sintéticos
  extraídos con el renderer real y Poppler; no usan servicios ni registros reales.

Los tests verifican que las entradas permanecen intactas. Las regresiones nuevas
se complementan con las suites existentes de impuestos, geometría y paginación.
