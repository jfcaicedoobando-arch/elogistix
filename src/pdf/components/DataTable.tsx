import { View, Text } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { Fragment } from "react";
import { styles } from "../theme/styles";

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
 * la legibilidad. Cada fila no se rompe entre páginas.
 */
export function DataTable<T>({ columns, rows, renderSubrow }: Props<T>) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        {columns.map((col) => (
          <Text key={col.key} style={[styles.th, ...flat(col.cellStyle)]}>
            {col.title}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => {
        const subrow = renderSubrow?.(row);
        const rowStyle = i % 2 === 1 ? styles.tableRowZebra : styles.tableRow;
        return (
          <Fragment key={i}>
            <View style={rowStyle} wrap={false}>
              {columns.map((col) => (
                <Text key={col.key} style={[styles.td, ...flat(col.cellStyle)]}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </Text>
              ))}
            </View>
            {subrow ? (
              <View style={rowStyle} wrap={false}>
                <Text style={[styles.td, styles.cellDesc, { fontStyle: "italic", color: "#64748B" }]}>
                  ↳ {subrow}
                </Text>
              </View>
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

function flat(s: Style | Style[] | undefined): Style[] {
  if (!s) return [];
  return Array.isArray(s) ? s : [s];
}
