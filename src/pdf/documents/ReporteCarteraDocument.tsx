/**
 * PDF contable de Cartera y Antigüedad (CxC + CxP).
 *
 * Recibe filas ya calculadas y formateadas por
 * `@/features/reportes/cartera/services/carteraExport` (contrato local, sin
 * depender del feature) y muestra, para cada bloque, la antigüedad por cubeta
 * y el detalle de facturas con su valuación histórica y al corte.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { nombreEmisorReporte, reporteHeaderTextStyle } from "./reporteLayout";

export interface FilaFacturaPdf {
  contraparte: string;
  folio: string;
  expediente: string;
  vencimiento: string;
  dias: string;
  bucket: string;
  moneda: string;
  saldo: string;
  mxnHistorico: string;
  mxnCorte: string;
  diferencia: string;
}

export interface FilaTotalPdf {
  etiqueta: string;
  conteo: string;
  mxnHistorico: string;
  mxnCorte: string;
  diferencia: string;
}

export interface BloqueCarteraPdf {
  titulo: string;
  totales: FilaTotalPdf[];
  facturas: FilaFacturaPdf[];
}

interface Props {
  fechaCorte: string;
  leyendaTc: string;
  leyendaValuacion?: string;
  busqueda?: string;
  bloques: BloqueCarteraPdf[];
  emisor?: EmisorInfo;
}

const money = (valor: string, moneda = "MXN") =>
  formatCurrency(Number(valor) || 0, moneda);

// LETTER horizontal: 792pt - 72pt de márgenes = 720pt. Los anchos incluyen
// 10pt de padding. Reservar espacio real para ELNAC00030 y el nombre completo;
// DescriptionText ofrece cortes invisibles para tokens mayores a cada celda.
const columna = (width: number) => ({ width, flexGrow: 0, flexShrink: 0 });
const COL_IMPORTE = { ...styles.cellNumWide, ...columna(79) };

const colsTotales: PdfColumn<FilaTotalPdf>[] = [
  { key: "etiqueta", title: "Antigüedad", cellStyle: styles.cellDesc, render: (r) => r.etiqueta },
  { key: "conteo", title: "#", cellStyle: styles.cellQty, render: (r) => r.conteo },
  { key: "hist", title: "MXN\nhistórico", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN\nal corte", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif.\ncambiaria", cellStyle: styles.cellNumWide, render: (r) => money(r.diferencia) },
];

const colsFacturas: PdfColumn<FilaFacturaPdf>[] = [
  { key: "contraparte", title: "Cliente / Proveedor", cellStyle: columna(134), hyphenate: false, render: (r) => r.contraparte },
  { key: "folio", title: "Folio", cellStyle: columna(62), hyphenate: false, render: (r) => r.folio },
  { key: "exp", title: "Exp.", cellStyle: columna(66), hyphenate: false, render: (r) => r.expediente },
  { key: "venc", title: "Vence", cellStyle: columna(62), hyphenate: false, render: (r) => r.vencimiento },
  { key: "dias", title: "Días", cellStyle: { ...styles.cellQty, ...columna(26) }, hyphenate: false, render: (r) => r.dias },
  { key: "bucket", title: "Rango", cellStyle: columna(54), hyphenate: false, render: (r) => r.bucket },
  { key: "saldo", title: "Saldo", cellStyle: COL_IMPORTE, render: (r) => money(r.saldo, r.moneda) },
  { key: "hist", title: "MXN\nhistórico", cellStyle: COL_IMPORTE, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN\nal corte", cellStyle: COL_IMPORTE, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif.\ncambiaria", cellStyle: COL_IMPORTE, render: (r) => money(r.diferencia) },
];

export function ReporteCarteraDocument({ fechaCorte, leyendaTc, leyendaValuacion, bloques, emisor, busqueda }: Props) {
  const filtro = busqueda?.trim();
  const empresaNombre = nombreEmisorReporte(emisor);
  return (
    <Document title={`Cartera y antigüedad ${fechaCorte}`} author={empresaNombre ?? "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Cartera y antigüedad" emisor={emisor}>
          <Text style={styles.contextText}>Corte: {formatDate(fechaCorte)}</Text>
          <Text style={styles.contextText}>{leyendaTc}</Text>
          {leyendaValuacion ? <Text style={styles.contextText}>{leyendaValuacion}</Text> : null}
          <Text style={styles.contextText}>
            {filtro ? `Filtro de búsqueda: ${filtro}. Totales sólo de resultados coincidentes.` : "Alcance: cartera con saldo pendiente, sin filtro de búsqueda."}
          </Text>
        </ReportHeader>

        {bloques.map((b) => (
          <View key={b.titulo}>
            {/* Five aging buckets plus their total are a bounded summary: move
                the entire section rather than painting a clipped fixed header. */}
            <View wrap={false}>
              <Text style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Antigüedad</Text>
              <DataTable columns={colsTotales} rows={b.totales} headerTextStyle={reporteHeaderTextStyle} />
            </View>

            <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Detalle de facturas</Text>
            {b.facturas.length === 0 ? (
              <Text style={styles.emptyState}>Sin saldos pendientes.</Text>
            ) : (
              <DataTable columns={colsFacturas} rows={b.facturas} headerTextStyle={reporteHeaderTextStyle} />
            )}
          </View>
        ))}

        <Footer emisor={emisor} empresaNombre={empresaNombre} />
      </Page>
    </Document>
  );
}
