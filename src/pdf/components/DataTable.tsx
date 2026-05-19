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
 * (no <table> HTML). Cada fila puede romperse entre páginas si es muy alta,
 * pero la descripción se envuelve dentro de la celda sin desbordar.
 */
export function DataTable<T extends Record<string, unknown>>({ columns, rows, renderSubrow }: Props<T>) {
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
        return (
          <Fragment key={i}>
            <View style={styles.tableRow} wrap={false}>
              {columns.map((col) => (
                <Text key={col.key} style={[styles.td, ...flat(col.cellStyle)]}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </Text>
              ))}
            </View>
            {subrow ? (
              <View style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, styles.cellDesc, { fontStyle: "italic", color: "#888" }]}>
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
