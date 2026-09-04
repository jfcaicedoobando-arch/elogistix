import { View, Text } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { styles } from "../theme/styles";
import { COLORS } from "@/pdf/theme/tokens";
import { sanitizePdfText } from "../text/sanitizePdfText";

export interface PdfColumn<T> {
  key: string;
  title: string;
  /** Estilo de celda (ancho/alineación). Usa styles.cellDesc / cellNum / cellQty. */
  cellStyle?: Style | Style[];
  /** Render de la celda; si se omite se usa row[key] crudo. */
  render?: (row: T) => string;
}

interface Props<T> {
  columns: PdfColumn<T>[];
  rows: T[];
  /** Renderiza una fila adicional (nota) debajo de cada row. */
  renderSubrow?: (row: T) => string | null;
}

/**
 * Tabla genérica para @react-pdf/renderer. Construida con <View> en Flexbox
 * (no <table> HTML). Aplica zebra striping real en filas pares para mejorar
 * la legibilidad.
 *
 * Tipografía defensiva (12.61.9):
 * - Cada `<View>` de fila usa `wrap` para permitir que descripciones largas
 *   (incoterms complejos, listas de contenedores, descripciones de mercancía)
 *   se distribuyan en múltiples líneas y, si caen al borde de la página,
 *   salten naturalmente sin cortar el contenido a la mitad.
 * - Las columnas numéricas (`cellNum`, `cellNumWide`, `cellQty`) usan
 *   `flexGrow: 0` + `flexShrink: 0` en `styles.ts` → ancho INVIOLABLE: nunca
 *   serán empujadas ni comprimidas por una celda `cellDesc` con texto largo.
 * - `cellDesc` usa `minWidth: 0` para garantizar wrap real en flex.
 */
export function DataTable<T>({ columns, rows, renderSubrow }: Props<T>) {
  return (
    <View style={styles.table}>
      {/*
        EXCEPCIÓN documentada al contrato de `fixed` de Page:
        `tableHeader fixed` indica a react-pdf que repita el encabezado de la
        tabla en cada página cuando las filas saltan. NO es un fixed de Page
        ni decorativo — es el patrón estándar de tablas multi-página.
      */}
      <View style={styles.tableHeader} fixed>
        {columns.map((col) => (
          <Text key={col.key} style={[styles.th, ...flat(col.cellStyle)]}>
            {sanitizePdfText(col.title)}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => {
        const subrow = renderSubrow?.(row);
        const rowStyle = i % 2 === 1 ? styles.tableRowZebra : styles.tableRow;
        return (
          // v13.823.77: la fila (con su nota) no se parte entre páginas; antes
          // la descripción quedaba en una hoja y los importes en la siguiente.
          <View key={i} wrap={false}>
            <View style={rowStyle}>
              {columns.map((col) => (
                <Text key={col.key} style={[styles.td, ...flat(col.cellStyle)]} wrap>
                  {sanitizePdfText(
                    col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? ""),
                  )}
                </Text>
              ))}
            </View>
            {subrow ? (
              <View style={rowStyle}>
                <Text style={[styles.td, styles.cellDesc, { fontStyle: "italic", color: COLORS.subtle }]} wrap>
                  {`\u00B7 ${sanitizePdfText(subrow)}`}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

    </View>
  );
}

function flat(s: Style | Style[] | undefined): Style[] {
  if (!s) return [];
  return Array.isArray(s) ? s : [s];
}
