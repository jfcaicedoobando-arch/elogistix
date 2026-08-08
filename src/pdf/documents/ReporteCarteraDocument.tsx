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
  bloques: BloqueCarteraPdf[];
  emisor?: { razonSocial?: string };
}

const money = (valor: string, moneda = "MXN") =>
  formatCurrency(Number(valor) || 0, moneda);

const COL_CORTA = { width: 58, flexGrow: 0, flexShrink: 0 } as const;

const colsTotales: PdfColumn<FilaTotalPdf>[] = [
  { key: "etiqueta", title: "Antigüedad", cellStyle: styles.cellDesc, render: (r) => r.etiqueta },
  { key: "conteo", title: "#", cellStyle: styles.cellQty, render: (r) => r.conteo },
  { key: "hist", title: "MXN histórico", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN al corte", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif. cambiaria", cellStyle: styles.cellNumWide, render: (r) => money(r.diferencia) },
];

const colsFacturas: PdfColumn<FilaFacturaPdf>[] = [
  { key: "contraparte", title: "Cliente / Proveedor", cellStyle: styles.cellDesc, render: (r) => r.contraparte },
  { key: "folio", title: "Folio", cellStyle: COL_CORTA, render: (r) => r.folio },
  { key: "exp", title: "Expediente", cellStyle: COL_CORTA, render: (r) => r.expediente },
  { key: "venc", title: "Vence", cellStyle: COL_CORTA, render: (r) => r.vencimiento },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => r.dias },
  { key: "bucket", title: "Antigüedad", cellStyle: COL_CORTA, render: (r) => r.bucket },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => money(r.saldo, r.moneda) },
  { key: "hist", title: "MXN histórico", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnHistorico) },
  { key: "corte", title: "MXN al corte", cellStyle: styles.cellNumWide, render: (r) => money(r.mxnCorte) },
  { key: "dif", title: "Dif. cambiaria", cellStyle: styles.cellNumWide, render: (r) => money(r.diferencia) },
];

export function ReporteCarteraDocument({ fechaCorte, leyendaTc, bloques, emisor }: Props) {
  return (
    <Document title={`Cartera y antigüedad ${fechaCorte}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Cartera y antigüedad</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              Corte: {formatDate(fechaCorte)}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>{leyendaTc}</Text>
          </View>
        </View>

        {bloques.map((b) => (
          <View key={b.titulo}>
            <Text style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Antigüedad</Text>
            <DataTable columns={colsTotales} rows={b.totales} />

            <Text style={[styles.h3, { marginTop: 10 }]}>{b.titulo} — Detalle de facturas</Text>
            {b.facturas.length === 0 ? (
              <Text style={styles.paragraph}>Sin saldos pendientes.</Text>
            ) : (
              <DataTable columns={colsFacturas} rows={b.facturas} />
            )}
          </View>
        ))}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
