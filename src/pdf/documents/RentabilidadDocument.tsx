import { METODOLOGIA_RENTABILIDAD } from "@/types/rentabilidad";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { COLORS } from "@/pdf/theme/tokens";
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
  emisor?: { razonSocial?: string };
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
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.h1, { lineHeight: 1.2 }]}>Rentabilidad por cliente</Text>
            {nombreComercial && <Text style={{ marginTop: 6, fontSize: 10 }}>Organización: {nombreComercial}</Text>}
            <Text style={{ marginTop: 6, fontSize: 10, lineHeight: 1.3, color: COLORS.muted }}>
              Período: {fechaDesde} - {fechaHasta}
              {modo && modo !== "all" ? `   ·   Modo: ${modo}` : ""}
            </Text>
          </View>
        </View>

        <Text style={[styles.paragraph, { fontSize: 9, color: COLORS.muted }]}>{METODOLOGIA_RENTABILIDAD}</Text>

        <View style={styles.kpiRow}>
          {[
            { l: "Venta total", v: formatCurrency(kpis.total_venta_usd, "USD") },
            { l: "Costo total", v: formatCurrency(kpis.total_costo_usd, "USD") },
            { l: "Utilidad total", v: formatCurrency(kpis.total_profit_usd, "USD") },
            { l: "Margen global", v: kpis.total_venta_usd === 0 ? "No calculable" : `${kpis.margen_promedio.toFixed(1)}%` },
          ].map((k) => (
            <View key={k.l} style={styles.kpiCard}>
              <View style={styles.kpiInner}>
                <Text style={styles.kpiLabel}>{k.l}</Text>
                <Text style={styles.kpiValue}>{k.v}</Text>
              </View>
            </View>
          ))}
        </View>

        {rows.length === 0 ? (
          <Text style={styles.paragraph}>No hay datos en el período seleccionado.</Text>
        ) : (
          <DataTable columns={cols} rows={rows} headerTextStyle={reporteHeaderTextStyle} />
        )}

        <Footer empresaNombre={empresaNombre} />
      </Page>
    </Document>
  );
}
