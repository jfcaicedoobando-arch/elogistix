/**
 * Documento PDF: Estado de cuenta por cliente.
 *
 * Lista facturas del corte seleccionado con su saldo neto, aging (Por vencer, 1-30, 31-60,
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
import { ReportSummary } from "../components/ReportSummary";
import { Footer } from "../components/Footer";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { EstadoCuentaAlcanceResumen, type EstadoCuentaAlcance } from "../components/EstadoCuentaAlcance";

export interface EstadoCuentaRow {
  numero: string;
  expediente: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  moneda: string;
  total: number;
  saldo: number;
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
  alcance?: EstadoCuentaAlcance;
}

const alertaCell: Style = { color: COLORS.warningFg, fontFamily: FONTS.bold };
const boldCell: Style = { fontFamily: FONTS.bold };
const compactCell: Style = { paddingVertical: 4 };

const cols: PdfColumn<EstadoCuentaRow>[] = [
  { key: "numero", title: "Factura", hyphenate: false, cellStyle: { width: 92, flexGrow: 0, flexShrink: 0 }, render: (r) => r.numero },
  { key: "expediente", title: "Expediente", cellStyle: styles.cellDesc, render: (r) => r.expediente },
  { key: "emision", title: "Emisión", cellStyle: { width: 66, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_emision) },
  { key: "vencimiento", title: "Vencimiento", cellStyle: { width: 84, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatDate(r.fecha_vencimiento) },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => (r.diasVencido > 0 ? `+${r.diasVencido}` : String(r.diasVencido)) },
  { key: "bucket", title: "Antigüedad", cellStyle: { width: 74, flexGrow: 0, flexShrink: 0 }, render: (r) => r.bucket },
  { key: "estado", title: "Estado", cellStyle: { width: 52, flexGrow: 0, flexShrink: 0 }, render: (r) => r.estado },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellMoney, render: (r) => formatCurrency(r.saldo, r.moneda) },
];

/** Días y antigüedad de facturas vencidas en color de alerta. */
function acentoVencida(row: EstadoCuentaRow, colKey: string): Style | undefined {
  if (row.diasVencido > 0 && (colKey === "dias" || colKey === "bucket")) return { ...compactCell, ...alertaCell };
  return compactCell;
}

interface AgingFila {
  label: string;
  total: number;
  esTotal: boolean;
}

function AgingTable({ tot, parcial }: { tot: EstadoCuentaMonedaTotal; parcial: boolean }) {
  const filas: AgingFila[] = [
    ...tot.buckets.map((b) => ({ label: b.label, total: b.total, esTotal: false })),
    { label: parcial ? "Subtotal del corte" : "Total", total: tot.total, esTotal: true },
  ];
  const agingCols: PdfColumn<AgingFila>[] = [
    { key: "label", title: `Antigüedad — ${tot.moneda}`, cellStyle: styles.cellDesc, render: (r) => r.label },
    { key: "total", title: "Total", cellStyle: { width: 100, textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.total, tot.moneda) },
  ];
  return (
    <View style={{ marginTop: 6 }} wrap={false}>
      <DataTable
        columns={agingCols}
        rows={filas}
        cellStyleForRow={(r) => (r.esTotal ? boldCell : undefined)}
      />
    </View>
  );
}

function KpisMoneda({ tot, parcial }: { tot: EstadoCuentaMonedaTotal; parcial: boolean }) {
  const porVencer = tot.buckets.find((b) => b.label === "Por vencer")?.total ?? 0;
  const vencido = tot.total - porVencer;
  const prefijo = parcial ? "Subtotal " : "";
  const kpis = [
    { label: `${prefijo}Pendiente ${tot.moneda}`, value: formatCurrency(tot.total, tot.moneda), alerta: false },
    { label: `${prefijo}Vencido ${tot.moneda}`, value: formatCurrency(vencido, tot.moneda), alerta: vencido > 0 },
    { label: `${prefijo}Por vencer ${tot.moneda}`, value: formatCurrency(porVencer, tot.moneda), alerta: false },
  ];
  return <ReportSummary columns={3} items={kpis.map((k) => ({ label: k.label, value: k.value, tone: k.alerta ? "warning" : "default" }))} />;
}

export function EstadoCuentaDocument({ cliente, rows, totalesPorMoneda, emisor, alcance }: Props) {
  const direccion = [cliente.direccion, cliente.ciudad, cliente.estado].filter(Boolean).join(", ");
  const meta = [
    ...(cliente.rfc ? [{ label: "RFC", value: cliente.rfc }] : []),
    { label: "Generado", value: formatDate(new Date().toISOString()) },
  ];
  const notaContacto = emisor?.contacto
    ? `Para cualquier aclaración sobre este estado de cuenta: ${emisor.contacto}`
    : "Para cualquier aclaración sobre este estado de cuenta, contáctanos.";
  return (
    <Document title={`Estado de cuenta — ${cliente.nombre}`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Empresa"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <BrandHeader
          tipoDocumento="Estado de cuenta"
          variant="report"
          folio={cliente.nombre}
          meta={meta}
          emisor={emisor}
        />
        {direccion ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginBottom: 8 }}>{direccion}</Text>
        ) : null}
        {alcance && <EstadoCuentaAlcanceResumen alcance={alcance} facturas={rows.length} />}

        {rows.length === 0 ? (
          <Text style={styles.emptyState}>No hay facturas pendientes.</Text>
        ) : (
          <View>
            {totalesPorMoneda.map((t) => (
              <KpisMoneda key={`kpi-${t.moneda}`} tot={t} parcial={alcance?.parcial === true} />
            ))}
            <DataTable columns={cols} rows={rows} cellStyleForRow={acentoVencida} />
            {totalesPorMoneda.map((t, i) => (
              <View key={t.moneda} wrap={false}>
                <AgingTable tot={t} parcial={alcance?.parcial === true} />
                {i === totalesPorMoneda.length - 1 ? <Text style={{ marginTop: 6, fontSize: 8, color: COLORS.muted }}>{notaContacto}</Text> : null}
              </View>
            ))}
            {totalesPorMoneda.length === 0 ? <Text style={{ marginTop: 6, fontSize: 8, color: COLORS.muted }}>{notaContacto}</Text> : null}
          </View>
        )}

        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
