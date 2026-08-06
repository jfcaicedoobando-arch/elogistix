import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { FacturaCobranza } from "@/features/facturacion/services";
import type { FacturaCxP } from "@/features/cxp/services";
import { COLORS } from "@/pdf/theme/tokens";

interface Props {
  fechaCorte: string; // YYYY-MM-DD
  cxc: FacturaCobranza[];
  cxp: FacturaCxP[];
  emisor?: { razonSocial?: string };
}

interface AgingRow { bucket: string; mxn: number; usd: number; count: number }

function buildAging<T extends { saldo: number; moneda: string; dias_vencido: number }>(
  items: T[],
): AgingRow[] {
  const buckets = [
    { bucket: "0–30 días", min: -Infinity, max: 30 },
    { bucket: "31–60 días", min: 31, max: 60 },
    { bucket: "61–90 días", min: 61, max: 90 },
    { bucket: "+90 días", min: 91, max: Infinity },
  ];
  return buckets.map((b) => {
    const subset = items.filter((i) => i.dias_vencido >= b.min && i.dias_vencido <= b.max && i.saldo > 0.01);
    let mxn = 0, usd = 0;
    for (const it of subset) {
      if (it.moneda === "USD") usd += it.saldo;
      else mxn += it.saldo;
    }
    return { bucket: b.bucket, mxn, usd, count: subset.length };
  });
}

const colsAging: PdfColumn<AgingRow>[] = [
  { key: "bucket", title: "Antigüedad", cellStyle: styles.cellDesc, render: (r) => r.bucket },
  { key: "qty", title: "#", cellStyle: styles.cellQty, render: (r) => String(r.count) },
  { key: "mxn", title: "MXN", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.mxn, "MXN") },
  { key: "usd", title: "USD", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.usd, "USD") },
];

const colsTopCxC: PdfColumn<FacturaCobranza>[] = [
  { key: "cli", title: "Cliente", cellStyle: styles.cellDesc, render: (r) => r.cliente_nombre },
  { key: "fol", title: "Folio", cellStyle: styles.cellQty, render: (r) => r.numero },
  { key: "ven", title: "Vence", cellStyle: styles.cellQty, render: (r) => r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "—" },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.saldo, r.moneda) },
];

const colsTopCxP: PdfColumn<FacturaCxP>[] = [
  { key: "prov", title: "Proveedor", cellStyle: styles.cellDesc, render: (r) => r.proveedor_nombre },
  { key: "fol", title: "Folio", cellStyle: styles.cellQty, render: (r) => r.folio_proveedor },
  { key: "ven", title: "Vence", cellStyle: styles.cellQty, render: (r) => r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "—" },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.saldo, r.moneda) },
];

export function ReporteCarteraDocument({ fechaCorte, cxc, cxp, emisor }: Props) {
  const agingCxC = buildAging(cxc);
  const agingCxP = buildAging(cxp);
  const topCxC = [...cxc].filter((c) => c.saldo > 0.01).sort((a, b) => b.dias_vencido - a.dias_vencido).slice(0, 10);
  const topCxP = [...cxp].filter((c) => c.saldo > 0.01).sort((a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? "")).slice(0, 10);

  return (
    <Document title={`Cartera ${fechaCorte}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Cartera CxC + CxP</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>Corte: {formatDate(fechaCorte)}</Text>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 8 }]}>Cuentas por cobrar — Antigüedad</Text>
        <DataTable columns={colsAging} rows={agingCxC} />

        <Text style={[styles.h3, { marginTop: 12 }]}>Top 10 clientes con saldo vencido</Text>
        {topCxC.length === 0 ? (
          <Text style={styles.paragraph}>Sin cartera vencida.</Text>
        ) : (
          <DataTable columns={colsTopCxC} rows={topCxC} />
        )}

        <Text style={[styles.h3, { marginTop: 12 }]}>Cuentas por pagar — Antigüedad</Text>
        <DataTable columns={colsAging} rows={agingCxP} />

        <Text style={[styles.h3, { marginTop: 12 }]}>Top 10 proveedores con saldo</Text>
        {topCxP.length === 0 ? (
          <Text style={styles.paragraph}>Sin facturas por pagar.</Text>
        ) : (
          <DataTable columns={colsTopCxP} rows={topCxP} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
