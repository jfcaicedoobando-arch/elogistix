## Hallazgos

Inventario de `fixed` en `src/pdf/`:
- `Footer` → `fixed` (raíz de Page vía componente). ✅
- `BrandHeader.topBand` → `fixed` (raíz de Page vía fragment). ✅
- `DataTable.tableHeader` → `fixed` (anidado dentro de `View` de tabla — patrón estándar de react-pdf para repetir el header de tabla al cruzar página). ✅ No tocar.

Problemas detectados en los 2 documentos objetivo:

1. **`ProformaConsolidadaDocument.tsx`** — Dentro de `SeccionMoneda`, cada grupo de contenedor se envuelve en `<View key={...} wrap={false}>`. Cuando un contenedor tiene 20+ conceptos su tabla excede una página y `wrap={false}` impide el salto natural → el bloque desborda y rompe la maquetación de páginas secundarias. Además, `ProformaHeader` (con `BrandHeader` → topBand fixed) se inserta como fragment al inicio: correcto, pero conviene explicitarlo en JSDoc.

2. **`ReporteEjecutivoDocument.tsx`** — NO usa `BrandHeader` ni renderiza `topBand fixed`. Resultado: en páginas secundarias del reporte (cuando hay muchos deudores/alertas) no hay banda corporativa superior, rompiendo la uniformidad con el resto de PDFs y dejando el contenido pegado al borde superior salvo por `paddingTop: 40` del page style. El `<View style={styles.header}>` actual NO es fixed (correcto, sólo página 1).

## Alcance (sólo maquetación / estilos PDF)

### `src/pdf/documents/ProformaConsolidadaDocument.tsx`
- En `SeccionMoneda`, quitar `wrap={false}` del `<View>` que envuelve `containerBlock + DataTable + subtotal`. Esto permite que tablas largas salten de página manteniendo el `tableHeader fixed` repetido por `DataTable` y el `paddingTop: 40` del `page` como resguardo superior.
- Conservar el `wrap={false}` implícito a nivel de fila individual (ya viene de `DataTable`).
- Añadir JSDoc al componente declarando el contrato: "Los únicos elementos `fixed` viven a nivel raíz de `<Page>` — `topBand` (vía `BrandHeader`) y `Footer`. Sub-bloques NUNCA usan `fixed`."

### `src/pdf/documents/ReporteEjecutivoDocument.tsx`
- Añadir `<View style={styles.topBand} fixed />` como PRIMER hijo directo de `<Page>` para uniformar el resguardo superior corporativo en TODAS las páginas (la banda de 4pt en color primary aparece bajo `paddingTop: 40`).
- Confirmar que `<View style={styles.header}>` NO es `fixed` (sólo página 1 — comportamiento correcto del header con título + periodo).
- Confirmar `<Footer fixed />` ya presente (renderiza paginación correctamente).
- Añadir JSDoc declarando el mismo contrato: "fixed sólo en `topBand` y `Footer` a nivel raíz de Page".

### `src/pdf/components/DataTable.tsx`
- Añadir comentario en la línea del `tableHeader fixed` explicando que es la EXCEPCIÓN documentada del contrato: react-pdf usa `fixed` en headers de tabla para repetirlos en cada página cuando la tabla salta — no es un `fixed` decorativo ni de página, sino de tabla.

### Tests
- Nuevo `src/pdf/documents/__tests__/pageContract.test.tsx` que renderiza ambos documentos con datos mínimos via el stub y verifica:
  1. Se monta `pdf-doc` + `pdf-page`.
  2. No lanza excepciones de árbol inválido.
  3. (Inspección textual del JSX a través del stub) los documentos no añaden elementos `fixed` adicionales fuera del contrato.

### Versionado
- `src/constants/appVersion.ts` → `12.61.10`.
- `CHANGELOG.md` → entrada `[12.61.10]` describiendo el contrato de `fixed` y el wrap natural de secciones largas en proforma consolidada.

## Contrato resultante (documentado en JSDoc)

```text
<Page>
  <View topBand fixed />          ← banda corporativa repetida en cada página
  <BrandHeader/HeaderInline />    ← sólo página 1 (no fixed)
  ... contenido fluido ...        ← saltos naturales; tablas grandes
                                    re-renderizan tableHeader fixed
  <Footer fixed />                ← paginación repetida en cada página
</Page>
```

Cualquier `fixed` en sub-bloques distintos al `tableHeader` de `DataTable` se considera regresión.
