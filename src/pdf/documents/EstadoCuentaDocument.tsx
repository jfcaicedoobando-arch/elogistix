/**
 * Documento PDF: Estado de cuenta por cliente.
 *
 * Lista facturas emitidas/vencidas con aging (Por vencer, 1-30, 31-60,
 * 61-90, +90 días) y totales por moneda. Reemplaza al generador legacy
 * `window.open + print` (v13.823.248): ahora se descarga como archivo.
 *
 * Es puramente presentacional: las filas ya llegan con `diasVencido`,
 * `bucket` y los totales por moneda calculados desde el generador.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles, FONTS } from "../theme/styles";
import { COLORS } from "../theme/tokens";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";

export interface EstadoCuentaRow {
  numero: string;
  expediente: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  moneda: string;
  total: number;
  diasVencido: number;
  bucket: string;
}

export interface EstadoCuentaBucketTotal {
  label: string;
  total: number;
}

export interface EstadoCuentaMonedaTotal {
  moneda: string;
  total: number;
  buckets: EstadoCuentaBucketTotal[];
}

export interface EstadoCuentaCliente {
  nombre: string;
  rfc: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  estado?: string | null;
}

interface Props {
  cliente: EstadoCuentaCliente;
  rows: EstadoCuentaRow[];
  totalesPorMoneda: EstadoCuentaMonedaTotal[];
  emisor?: { razonSocial?: string };
}

const cols: PdfColumn<EstadoCuentaRow>[] = [
  { key: "numero", title: "Factura", cellStyle: { width: 62, flexGrow: 0, flexShrink: 0 }, render: (r) => r.numero },
  { key: "expediente", title: "Expediente", cellStyle: styles.cellDesc, render: (r) => r.expediente },
  { key: "emision", title: "Emisión", cellStyle: { width: 72, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_emision) },
  { key: "vencimiento", title: "Vencimiento", cellStyle: { width: 72, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_vencimiento) },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => (r.diasVencido > 0 ? `+${r.diasVencido}` : String(r.diasVencido)) },
  { key: "bucket", title: "Antigüedad", cellStyle: { width: 74, flexGrow: 0, flexShrink: 0 }, render: (r) => r.bucket },
  { key: "estado", title: "Estado", cellStyle: { width: 52, flexGrow: 0, flexShrink: 0 }, render: (r) => r.estado },
  { key: "total", title: "Total", cellStyle: styles.cellMoney, render: (r) => formatCurrency(r.total, r.moneda) },
];

function AgingTable({ tot }: { tot: EstadoCuentaMonedaTotal }) {
  const filas = [
    ...tot.buckets.map((b) => ({ label: b.label, total: b.total, esTotal: false })),
    { label: "Total", total: tot.total, esTotal: true },
  ];
  const agingCols: PdfColumn<(typeof filas)[number]>[] = [
    { key: "label", title: `Antigüedad — ${tot.moneda}`, cellStyle: styles.cellDesc, render: (r) => r.label },
    { key: "total", title: "Total", cellStyle: { width: 100, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.total, tot.moneda) },
  ];
  return <DataTable columns={agingCols} rows={filas} />;
}

export function EstadoCuentaDocument({ cliente, rows, totalesPorMoneda, emisor }: Props) {
  const direccion = [cliente.direccion, cliente.ciudad, cliente.estado].filter(Boolean).join(" ");
  return (
    <Document title={`Estado de cuenta — ${cliente.nombre}`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Estado de cuenta</Text>
            <Text style={{ marginTop: 4, fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink }}>
              {cliente.nombre}
              {cliente.rfc ? ` — RFC ${cliente.rfc}` : ""}
            </Text>
            {direccion ? (
              <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>{direccion}</Text>
            ) : null}
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLine}>Generado: {formatDate(new Date().toISOString())}</Text>
          </View>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.paragraph}>No hay facturas pendientes.</Text>
        ) : (
          <View>
            <DataTable columns={cols} rows={rows} />
            {totalesPorMoneda.map((t) => (
              <AgingTable key={t.moneda} tot={t} />
            ))}
          </View>
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
