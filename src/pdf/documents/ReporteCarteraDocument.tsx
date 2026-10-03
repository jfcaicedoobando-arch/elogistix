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
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { COLORS } from "@/pdf/theme/tokens";
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
  busqueda?: string;
  bloques: BloqueCarteraPdf[];
  emisor?: { razonSocial?: string };
}

const money = (valor: string, moneda = "MXN") =>
  formatCurrency(Number(valor) || 0, moneda);

const COL_CORTA = { width: 58, flexGrow: 0, flexShrink: 0 } as const;

const colsTotales: PdfColumn<FilaTotalPdf>[] = [
  { key: "etiqueta", title: "Antigüedad", cellStyle: styles.cellDesc, render: (r) => r.etiqueta },
  { key: "conteo", title: "#", cellStyle: styles.cellQty, render: (r) => r.conteo },
  { key: "hist", title: "MXN\nhistórico", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN\nal corte", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif.\ncambiaria", cellStyle: styles.cellNumWide, render: (r) => money(r.diferencia) },
];

const colsFacturas: PdfColumn<FilaFacturaPdf>[] = [
  { key: "contraparte", title: "Cliente / Proveedor", cellStyle: styles.cellDesc, render: (r) => r.contraparte },
  { key: "folio", title: "Folio", cellStyle: COL_CORTA, render: (r) => r.folio },
  { key: "exp", title: "Exp.", cellStyle: COL_CORTA, render: (r) => r.expediente },
  { key: "venc", title: "Vence", cellStyle: COL_CORTA, render: (r) => r.vencimiento },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => r.dias },
  { key: "bucket", title: "Rango", cellStyle: COL_CORTA, render: (r) => r.bucket },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => money(r.saldo, r.moneda) },
  { key: "hist", title: "MXN\nhistórico", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN\nal corte", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif.\ncambiaria", cellStyle: styles.cellNumWide, render: (r) => money(r.diferencia) },
];

export function ReporteCarteraDocument({ fechaCorte, leyendaTc, bloques, emisor, busqueda }: Props) {
  const filtro = busqueda?.trim();
  const empresaNombre = nombreEmisorReporte(emisor);
  return (
    <Document title={`Cartera y antigüedad ${fechaCorte}`} author={empresaNombre ?? "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.h1, { lineHeight: 1.2 }]}>Cartera y antigüedad</Text>
            <Text style={{ marginTop: 6, fontSize: 10, lineHeight: 1.3, color: COLORS.muted }}>
              Corte: {formatDate(fechaCorte)}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>{leyendaTc}</Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>
              {filtro ? `Filtro de búsqueda: ${filtro}. Totales sólo de resultados coincidentes.` : "Alcance: cartera con saldo pendiente, sin filtro de búsqueda."}
            </Text>
          </View>
        </View>

        {bloques.map((b) => (
          <View key={b.titulo}>
            <Text style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Antigüedad</Text>
            <DataTable columns={colsTotales} rows={b.totales} headerTextStyle={reporteHeaderTextStyle} />

            <Text style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Detalle de facturas</Text>
            {b.facturas.length === 0 ? (
              <Text style={styles.paragraph}>Sin saldos pendientes.</Text>
            ) : (
              <DataTable columns={colsFacturas} rows={b.facturas} headerTextStyle={reporteHeaderTextStyle} />
            )}
          </View>
        ))}

        <Footer empresaNombre={empresaNombre} />
      </Page>
    </Document>
  );
}
