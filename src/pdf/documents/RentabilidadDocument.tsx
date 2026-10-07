import { METODOLOGIA_RENTABILIDAD } from "@/types/rentabilidad";
import { Document, Page, Text } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { nombreEmisorReporte, reporteHeaderTextStyle } from "./reporteLayout";

export interface RentabilidadClienteRow {
  cliente_nombre: string;
  total_embarques: number;
  venta_usd: number;
  costo_usd: number;
  profit_usd: number;
  margen: number;
}

export interface RentabilidadKpis {
  total_venta_usd: number;
  total_costo_usd: number;
  total_profit_usd: number;
  margen_promedio: number;
}

interface Props {
  fechaDesde: string;
  fechaHasta: string;
  modo?: string;
  kpis: RentabilidadKpis;
  clientes: RentabilidadClienteRow[];
  emisor?: EmisorInfo;
  /** Identificador comercial del tenant; no es una razón social/RFC fiscal. */
  organizacionNombre?: string;
}

const cols: PdfColumn<RentabilidadClienteRow>[] = [
  { key: "cliente", title: "Cliente", cellStyle: styles.cellDesc, render: (r) => r.cliente_nombre },
  { key: "emb", title: "Embarques", cellStyle: [styles.cellQty, { width: 65 }], render: (r) => String(r.total_embarques) },
  { key: "venta", title: "Venta", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.venta_usd, "USD") },
  { key: "costo", title: "Costo", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.costo_usd, "USD") },
  { key: "profit", title: "Utilidad", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.profit_usd, "USD") },
  { key: "margen", title: "Margen", cellStyle: styles.cellNum, render: (r) => r.venta_usd === 0 ? "No calculable" : `${r.margen.toFixed(1)}%` },
];

export function RentabilidadDocument({ fechaDesde, fechaHasta, modo, kpis, clientes, emisor, organizacionNombre }: Props) {
  const rows = [...clientes].sort((a, b) => b.profit_usd - a.profit_usd);
  const nombreComercial = organizacionNombre?.trim();
  const empresaNombre = nombreComercial || nombreEmisorReporte(emisor);
  return (
    <Document title="Rentabilidad por cliente" author={empresaNombre ?? "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Rentabilidad por cliente" emisor={emisor} organizacionNombre={nombreComercial}>
          {nombreComercial && <Text style={styles.contextText}>Organización: {nombreComercial}</Text>}
          <Text style={styles.contextText}>
            Período: {fechaDesde} - {fechaHasta}
            {modo && modo !== "all" ? `   ·   Modo: ${modo}` : ""}
          </Text>
        </ReportHeader>

        <ReportContext>
          <Text style={styles.contextText}>{METODOLOGIA_RENTABILIDAD}</Text>
        </ReportContext>

        <ReportSummary columns={4} items={[
          { label: "Venta total", value: formatCurrency(kpis.total_venta_usd, "USD") },
          { label: "Costo total", value: formatCurrency(kpis.total_costo_usd, "USD") },
          { label: "Utilidad total", value: formatCurrency(kpis.total_profit_usd, "USD") },
          { label: "Margen global", value: kpis.total_venta_usd === 0 ? "No calculable" : `${kpis.margen_promedio.toFixed(1)}%` },
        ]} />

        {rows.length === 0 ? (
          <Text style={styles.emptyState}>No hay datos en el período seleccionado.</Text>
        ) : (
          <DataTable columns={cols} rows={rows} headerTextStyle={reporteHeaderTextStyle} />
        )}

        <Footer empresaNombre={empresaNombre} />
      </Page>
    </Document>
  );
}
