## Contexto
`DataTable` actualmente renderiza cada fila con `wrap={false}` (impide saltos de página y, peor, deja que celdas `cellDesc` con strings largos —incoterms compuestos, listas de contenedores, descripciones de mercancía— rompan visualmente las columnas numéricas adyacentes). Los estilos en `stylesContent.ts` no fijan `flexShrink` en las columnas numéricas, así que un texto largo puede expandir la celda y empujar/cortar los totales. `cellDesc` no tiene `minWidth: 0`, lo que en flex puede impedir el wrap natural.

## Alcance (sólo presentación / estilos PDF)

### `src/pdf/theme/stylesContent.ts`
- `td`: agregar `overflow: "hidden"` y `flexShrink: 1` como base defensiva para todas las celdas.
- `cellDesc`: añadir `minWidth: 0` (clave en flex para permitir wrap real) y mantener `flexGrow: 1, flexShrink: 1, flexBasis: 0`.
- `cellNum`, `cellNumWide`, `cellQty`: añadir `flexGrow: 0` y `flexShrink: 0` para blindar el ancho fijo de las columnas de totales — un texto largo en la descripción jamás podrá empujarlas ni recortarlas.
- `tableRow` / `tableRowZebra`: añadir `alignItems: "stretch"` para que filas con varias líneas de descripción mantengan alineación vertical limpia con las celdas numéricas.
- `th`: replicar el mismo blindado (`overflow: "hidden"`) para encabezados.

### `src/pdf/components/DataTable.tsx`
- Quitar `wrap={false}` de la fila principal y reemplazarlo por `wrap={true}` explícito en el `<View>` de cada `tableRow` y en el subrow — permite que descripciones largas que ocupen 2-3 líneas se distribuyan naturalmente y, si caen al borde de página, salten sin cortar el contenido a la mitad.
- Mantener `wrap` del encabezado fijo (`fixed`) sin cambios — sigue repitiéndose en cada página.
- Documentar en JSDoc del componente el contrato de tipografía defensiva (descripciones largas hacen wrap; columnas numéricas tienen ancho inviolable).

### `src/pdf/documents/cotizacionSections.tsx`
- El `<Text>` libre que renderiza `c.descripcion_adicional` (línea 90) recibe un estilo inline mínimo (`{ fontSize: 9 }` heredado del page) pero sin garantía de wrap controlado dentro del `View`. Envolverlo con `style={{ ...styles.paragraph, fontSize: 9 }}` y asegurar que el `View` contenedor permita wrap natural (no requiere cambios estructurales — solo asegurar la consistencia tipográfica con el resto del documento).
- Sin cambios de lógica de negocio.

### Tests
- Nuevo test `src/pdf/components/__tests__/DataTable.test.tsx` que renderiza la tabla (usa el stub existente `src/test/mocks/reactPdfStub.tsx`) con una fila cuya celda `cellDesc` contiene 600+ caracteres y verifica:
  1. El `<View>` de la fila tiene `wrap={true}` (no `false`).
  2. Las celdas numéricas conservan sus estilos `flexShrink: 0` / `width` fijo.
  3. La celda de descripción tiene `flexGrow: 1` / `minWidth: 0`.

### Versionado
- `src/constants/appVersion.ts` → `12.61.9`.
- `CHANGELOG.md` → entrada `[12.61.9]` describiendo tipografía defensiva en tablas PDF.

## Detalle técnico

```text
Modelo flex actual de una fila:
  [ cellDesc (flex 1, basis 0) ][ cellQty 38px ][ cellNum 65px ][ cellNum 65px ]
                                  ^^^ sin flexShrink:0 → un texto largo podía
                                      forzar a las celdas a comprimirse

Modelo blindado:
  cellDesc:  flexGrow 1, flexShrink 1, flexBasis 0, minWidth 0   ← wrap real
  cellNum*:  width fijo, flexGrow 0, flexShrink 0                ← inviolable
  td:        overflow: hidden                                    ← contención
  row:       wrap=true, alignItems: stretch                      ← multi-línea OK
```

No se introducen nuevas dependencias ni cambios de API pública.
