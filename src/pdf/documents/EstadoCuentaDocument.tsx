/**
 * Documento PDF: Estado de cuenta por cliente.
 *
 * Lista facturas emitidas/vencidas con aging (Por vencer, 1-30, 31-60,
 * 61-90, +90 días) y totales por moneda. Reemplaza al generador legacy
 * `window.open + print` (v13.823.248): ahora se descarga como archivo.
 * v13.823.249 — pulido profesional: BrandHeader corporativo, KPIs de
 * pendiente/vencido por moneda, acento en filas vencidas, filas de total
 * en bold y nota de contacto para aclaraciones.
 *
 * Es puramente presentacional: las filas ya llegan con `diasVencido`,
 * `bucket` y los totales por moneda calculados desde el generador.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles, FONTS } from "../theme/styles";
import { COLORS } from "../theme/tokens";
import { Footer } from "../components/Footer";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
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
  emisor?: EmisorInfo;
}

const alertaCell: Style = { color: COLORS.warningFg, fontFamily: FONTS.bold };
const boldCell: Style = { fontFamily: FONTS.bold };

const cols: PdfColumn<EstadoCuentaRow>[] = [
  { key: "numero", title: "Factura", cellStyle: { width: 62, flexGrow: 0, flexShrink: 0 }, render: (r) => r.numero },
  { key: "expediente", title: "Expediente", cellStyle: styles.cellDesc, render: (r) => r.expediente },
  { key: "emision", title: "Emisión", cellStyle: { width: 66, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_emision) },
  { key: "vencimiento", title: "Vencimiento", cellStyle: { width: 84, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_vencimiento) },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => (r.diasVencido > 0 ? `+${r.diasVencido}` : String(r.diasVencido)) },
  { key: "bucket", title: "Antigüedad", cellStyle: { width: 74, flexGrow: 0, flexShrink: 0 }, render: (r) => r.bucket },
  { key: "estado", title: "Estado", cellStyle: { width: 52, flexGrow: 0, flexShrink: 0 }, render: (r) => r.estado },
  { key: "total", title: "Total", cellStyle: styles.cellMoney, render: (r) => formatCurrency(r.total, r.moneda) },
];

/** Días y antigüedad de facturas vencidas en color de alerta. */
function acentoVencida(row: EstadoCuentaRow, colKey: string): Style | undefined {
  if (row.diasVencido > 0 && (colKey === "dias" || colKey === "bucket")) return alertaCell;
  return undefined;
}

interface AgingFila {
  label: string;
  total: number;
  esTotal: boolean;
}

function AgingTable({ tot }: { tot: EstadoCuentaMonedaTotal }) {
  const filas: AgingFila[] = [
    ...tot.buckets.map((b) => ({ label: b.label, total: b.total, esTotal: false })),
    { label: "Total", total: tot.total, esTotal: true },
  ];
  const agingCols: PdfColumn<AgingFila>[] = [
    { key: "label", title: `Antigüedad — ${tot.moneda}`, cellStyle: styles.cellDesc, render: (r) => r.label },
    { key: "total", title: "Total", cellStyle: { width: 100, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.total, tot.moneda) },
  ];
  return (
    <View style={{ marginTop: 10 }}>
      <DataTable
        columns={agingCols}
        rows={filas}
        cellStyleForRow={(r) => (r.esTotal ? boldCell : undefined)}
      />
    </View>
  );
}

function KpisMoneda({ tot }: { tot: EstadoCuentaMonedaTotal }) {
  const porVencer = tot.buckets.find((b) => b.label === "Por vencer")?.total ?? 0;
  const vencido = tot.total - porVencer;
  const kpis = [
    { label: `Pendiente ${tot.moneda}`, value: formatCurrency(tot.total, tot.moneda), alerta: false },
    { label: `Vencido ${tot.moneda}`, value: formatCurrency(vencido, tot.moneda), alerta: vencido > 0 },
    { label: `Por vencer ${tot.moneda}`, value: formatCurrency(porVencer, tot.moneda), alerta: false },
  ];
  return (
    <View style={styles.kpiRow}>
      {kpis.map((k) => (
        <View key={k.label} style={styles.kpiCard}>
          <View style={styles.kpiInner}>
            <Text style={styles.kpiLabel}>{k.label}</Text>
            <Text style={[styles.kpiValue, k.alerta ? { color: COLORS.warningFg } : undefined]}>
              {k.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function EstadoCuentaDocument({ cliente, rows, totalesPorMoneda, emisor }: Props) {
  const direccion = [cliente.direccion, cliente.ciudad, cliente.estado].filter(Boolean).join(", ");
  const meta = [
    ...(cliente.rfc ? [{ label: "RFC", value: cliente.rfc }] : []),
    { label: "Generado", value: formatDate(new Date().toISOString()) },
  ];
  const notaContacto = emisor?.contacto
    ? `Para cualquier aclaración sobre este estado de cuenta: ${emisor.contacto}`
    : "Para cualquier aclaración sobre este estado de cuenta, contáctanos.";
  return (
    <Document title={`Estado de cuenta — ${cliente.nombre}`} author={emisor?.razonSocial ?? "Empresa"}>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          tipoDocumento="Estado de cuenta"
          folio={cliente.nombre}
          meta={meta}
          emisor={emisor}
        />
        {direccion ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 8 }}>{direccion}</Text>
        ) : null}

        {rows.length === 0 ? (
          <Text style={styles.paragraph}>No hay facturas pendientes.</Text>
        ) : (
          <View>
            {totalesPorMoneda.map((t) => (
              <KpisMoneda key={`kpi-${t.moneda}`} tot={t} />
            ))}
            <DataTable columns={cols} rows={rows} cellStyleForRow={acentoVencida} />
            {totalesPorMoneda.map((t) => (
              <AgingTable key={t.moneda} tot={t} />
            ))}
            <Text style={{ marginTop: 10, fontSize: 8, color: COLORS.muted }}>{notaContacto}</Text>
          </View>
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
