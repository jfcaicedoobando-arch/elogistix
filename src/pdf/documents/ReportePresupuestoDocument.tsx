/**
 * Reporte PDF: Presupuesto vs Real por categoría.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { ResumenVsReal, FilaVsReal } from "@/features/presupuesto/services";

interface Props {
  resumen: ResumenVsReal;
  emisor?: { razonSocial?: string };
}

const cols: PdfColumn<FilaVsReal>[] = [
  { key: "cat", title: "Categoría", cellStyle: styles.cellDesc, render: (r) => r.categoria_nombre },
  { key: "pre", title: "Presupuesto", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.presupuesto_mxn, "MXN") },
  { key: "real", title: "Real", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.real_mxn, "MXN") },
  { key: "var", title: "Variación", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.variacion_mxn, "MXN") },
  { key: "pct", title: "% cumpl.", cellStyle: styles.cellQty, render: (r) => r.presupuesto_mxn > 0 ? `${r.cumplimiento_pct.toFixed(1)}%` : "—" },
];

export function ReportePresupuestoDocument({ resumen, emisor }: Props) {
  return (
    <Document title={`Presupuesto ${resumen.periodo}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Presupuesto vs Real</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>Periodo: {resumen.periodo}</Text>
          </View>
        </View>

        <View style={[styles.kpiRow, { marginTop: 8 }]}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Total presupuesto</Text>
              <Text style={styles.kpiValue}>{formatCurrency(resumen.total_presupuesto_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Total real</Text>
              <Text style={styles.kpiValue}>{formatCurrency(resumen.total_real_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Variación neta</Text>
              <Text style={styles.kpiValue}>{formatCurrency(resumen.variacion_neta_mxn, "MXN")}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 12 }]}>Detalle por categoría</Text>
        {resumen.filas.length === 0 ? (
          <Text style={styles.paragraph}>Sin categorías configuradas.</Text>
        ) : (
          <DataTable columns={cols} rows={resumen.filas} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
