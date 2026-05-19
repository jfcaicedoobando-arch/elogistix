import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";

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
}

const cols: PdfColumn<RentabilidadClienteRow>[] = [
  { key: "cliente", title: "Cliente", cellStyle: styles.cellDesc, render: (r) => r.cliente_nombre },
  { key: "emb", title: "Embarques", cellStyle: styles.cellQty, render: (r) => String(r.total_embarques) },
  { key: "venta", title: "Venta", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.venta_usd, "USD") },
  { key: "costo", title: "Costo", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.costo_usd, "USD") },
  { key: "profit", title: "Profit", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.profit_usd, "USD") },
  { key: "margen", title: "Margen", cellStyle: styles.cellNum, render: (r) => `${r.margen.toFixed(1)}%` },
];

export function RentabilidadDocument({ fechaDesde, fechaHasta, modo, kpis, clientes }: Props) {
  const rows = [...clientes].sort((a, b) => b.profit_usd - a.profit_usd);
  return (
    <Document title="Rentabilidad por cliente" author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Rentabilidad por cliente</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: "#475569" }}>
              Período: {fechaDesde} → {fechaHasta}
              {modo && modo !== "all" ? `   ·   Modo: ${modo}` : ""}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {[
            { l: "Venta total", v: formatCurrency(kpis.total_venta_usd, "USD") },
            { l: "Costo total", v: formatCurrency(kpis.total_costo_usd, "USD") },
            { l: "Profit total", v: formatCurrency(kpis.total_profit_usd, "USD") },
            { l: "Margen promedio", v: `${kpis.margen_promedio.toFixed(1)}%` },
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
          <DataTable columns={cols} rows={rows} />
        )}

        <Footer />
      </Page>
    </Document>
  );
}
