import { View, Text } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { styles } from "../theme/styles";
import { COLORS } from "@/pdf/theme/tokens";
import { sanitizePdfText } from "../text/sanitizePdfText";
import { DescriptionText } from "../text/DescriptionText";

export interface PdfColumn<T> {
  key: string;
  title: string;
  /** Estilo de celda (ancho/alineación). Usa styles.cellDesc / cellNum / cellQty. */
  cellStyle?: Style | Style[];
  /** Render de la celda; si se omite se usa row[key] crudo. */
  render?: (row: T) => string;
  /** Descriptions can keep whole words instead of automatic syllable breaks. */
  hyphenate?: boolean;
}

interface Props<T> {
  columns: PdfColumn<T>[];
  rows: T[];
  /** Ajuste de tipografía del encabezado sin alterar los anchos de columnas. */
  headerTextStyle?: Style;
  /** Renderiza una fila adicional (nota) debajo de cada row. */
  renderSubrow?: (row: T) => string | null;
  /**
   * Estilo extra por celda según la fila (p. ej. bold en fila de totales o
   * color de alerta en filas vencidas). Opcional; sin efecto si se omite.
   */
  cellStyleForRow?: (row: T, colKey: string) => Style | undefined;
  /** Keep a following summary with the final data row, never on its own page. */
  afterLastRow?: ReactNode;
}

/**
 * Tabla genérica para @react-pdf/renderer. Construida con <View> en Flexbox
 * (no <table> HTML). Aplica zebra striping real en filas pares para mejorar
 * la legibilidad.
 *
 * Tipografía defensiva (12.61.9):
 * - Cada fila y su nota se mantienen juntas (`wrap={false}`); los Text
 *   internos sí permiten varias líneas. La fila completa salta de página
 *   cuando no cabe, sin separar la descripción de sus importes.
 * - Las columnas numéricas (`cellNum`, `cellNumWide`, `cellQty`) usan
 *   `flexGrow: 0` + `flexShrink: 0` en `styles.ts` → ancho INVIOLABLE: nunca
 *   serán empujadas ni comprimidas por una celda `cellDesc` con texto largo.
 * - `cellDesc` usa `minWidth: 0` para garantizar wrap real en flex.
 */
export function DataTable<T>({ columns, rows, headerTextStyle, renderSubrow, cellStyleForRow, afterLastRow }: Props<T>) {
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
          <Text key={col.key} style={[styles.th, ...flat(headerTextStyle), ...flat(col.cellStyle)]}>
            {sanitizePdfText(col.title)}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? <View wrap={false}><Text style={styles.emptyState}>Sin registros para mostrar.</Text>{afterLastRow}</View> : null}
      {rows.map((row, i) => {
        const subrow = renderSubrow?.(row);
        const rowStyle = i % 2 === 1 ? styles.tableRowZebra : styles.tableRow;
        return (
          // v13.823.77: la fila (con su nota) no se parte entre páginas; antes
          // la descripción quedaba en una hoja y los importes en la siguiente.
          <View key={i} wrap={false}>
            <View style={rowStyle}>
              {columns.map((col) => (
                <Text key={col.key} style={[styles.td, ...flat(col.cellStyle), ...flat(cellStyleForRow?.(row, col.key))]}
                  hyphenationCallback={col.hyphenate === false ? keepWordsIntact : undefined} wrap>
                  {cellContent(col, row)}
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
            {i === rows.length - 1 ? afterLastRow : null}
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

function keepWordsIntact(word: string): string[] {
  return [word];
}

function cellContent<T>(col: PdfColumn<T>, row: T) {
  const text = sanitizePdfText(col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? ""));
  const fixedWidth = flat(col.cellStyle).reduce<number | undefined>((width, style) => typeof style.width === "number" ? style.width : width, undefined);
  return col.hyphenate === false ? <DescriptionText text={text} maxWidth={fixedWidth ? Math.max(10, fixedWidth - 10) : undefined} /> : text;
}
