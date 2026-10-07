/**
 * Reporte PDF: Presupuesto vs Real por categoría.
 */
import { avisoNcProveedorSinBase } from "@/lib/financial/baseNcProveedor";
import { Document, Page, Text } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { ResumenVsReal, FilaVsReal } from "@/features/presupuesto/services";

interface Props {
  resumen: ResumenVsReal;
  filas?: FilaVsReal[];
  soloExcesos?: boolean;
  emisor?: EmisorInfo;
}

const cols: PdfColumn<FilaVsReal>[] = [
  { key: "cat", title: "Categoría", cellStyle: styles.cellDesc, render: (r) => r.categoria_nombre },
  { key: "pre", title: "Presupuesto", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.presupuesto_mxn, "MXN") },
  { key: "real", title: "Real", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.real_mxn, "MXN") },
  { key: "var", title: "Variación", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.variacion_mxn, "MXN") },
  { key: "pct", title: "% cumpl.", cellStyle: styles.cellQty, render: (r) => r.presupuesto_mxn > 0 ? `${r.cumplimiento_pct.toFixed(1)}%` : "—" },
];

export function ReportePresupuestoDocument({ resumen, filas = resumen.filas, soloExcesos = false, emisor }: Props) {
  return (
    <Document title={`Presupuesto ${resumen.periodo}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <ReportHeader title="Presupuesto vs Real" emisor={emisor}>
          <Text style={styles.contextText}>Periodo: {resumen.periodo}</Text>
        </ReportHeader>

        {!!resumen.notas_proveedor_sin_base_count && (
          <ReportContext>
            <Text style={styles.contextText}>{avisoNcProveedorSinBase(resumen.notas_proveedor_sin_base_count)}</Text>
          </ReportContext>
        )}
        <ReportSummary columns={3} items={[
          { label: "Total presupuesto", value: formatCurrency(resumen.total_presupuesto_mxn, "MXN") },
          { label: "Total real", value: formatCurrency(resumen.total_real_mxn, "MXN") },
          { label: "Variación neta", value: formatCurrency(resumen.variacion_neta_mxn, "MXN") },
        ]} />

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Detalle por categoría</Text>
        <ReportContext>
          <Text style={styles.contextText}>
            {soloExcesos ? "Filtro: Solo excesos (más del 110% del presupuesto)." : "Filtro: Todas las categorías."} Los indicadores superiores corresponden al periodo completo.
          </Text>
        </ReportContext>
        {filas.length === 0 ? (
          <Text style={styles.emptyState}>{soloExcesos ? "Ninguna categoría excede el 110% este mes." : "Sin categorías configuradas."}</Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
