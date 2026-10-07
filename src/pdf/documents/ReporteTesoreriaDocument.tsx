import { Document, Page, Text } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { ResumenTesoreria, ResumenCuenta, TopItem } from "@/features/tesoreria/services";
import { renglonesFlujoMonedas, type RenglonFlujoMoneda } from "@/features/tesoreria/domain";

interface Props {
  fechaCorte: string;
  resumen: ResumenTesoreria;
  emisor?: EmisorInfo;
}

const colsCuentas: PdfColumn<ResumenCuenta>[] = [
  { key: "alias", title: "Cuenta", cellStyle: styles.cellDesc, render: (r) => `${r.banco} · ${r.alias}` },
  { key: "mon", title: "Moneda", cellStyle: { width: 54, flexGrow: 0, flexShrink: 0 }, render: (r) => r.moneda },
  { key: "saldo", title: "Saldo actual", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.saldo, r.moneda) },
];

const colsTop: PdfColumn<TopItem>[] = [
  { key: "nom", title: "Nombre", cellStyle: styles.cellDesc, render: (r) => r.nombre },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.saldo, r.moneda) },
  { key: "dias", title: "Días\nvencidos", cellStyle: styles.cellNumWide, render: (r) => r.dias != null ? String(r.dias) : "—" },
];

const colsFlujo: PdfColumn<RenglonFlujoMoneda>[] = [
  { key: "moneda", title: "Moneda", cellStyle: { width: "16%", flexGrow: 0, flexShrink: 0 }, render: (r) => r.moneda },
  { key: "cobrar", title: "Por cobrar", cellStyle: { width: "28%", textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.cobrar, r.moneda) },
  { key: "pagar", title: "Por pagar", cellStyle: { width: "28%", textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.pagar, r.moneda) },
  { key: "neto", title: "Neto", cellStyle: { width: "28%", textAlign: "right", flexGrow: 0, flexShrink: 0 }, render: (r) => formatCurrency(r.neto, r.moneda) },
];

export function ReporteTesoreriaDocument({ fechaCorte, resumen, emisor }: Props) {
  const flujo = renglonesFlujoMonedas(resumen.flujo);
  return (
    <Document title={`Tesorería ${fechaCorte}`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <ReportHeader title="Resumen de Tesorería" emisor={emisor}>
          <Text style={styles.contextText}>Corte: {formatDate(fechaCorte)}</Text>
        </ReportHeader>

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 8 }]}>Saldos en bancos</Text>
        {resumen.cuentas.length === 0 ? (
          <Text style={styles.emptyState}>Sin cuentas bancarias configuradas.</Text>
        ) : (
          <DataTable columns={colsCuentas} rows={resumen.cuentas} />
        )}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Flujo esperado 30 días</Text>
        <DataTable columns={colsFlujo} rows={flujo} />

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Top 5 deudores vencidos por moneda</Text>
        {resumen.top_deudores.length === 0 ? (
          <Text style={styles.emptyState}>Sin deudores vencidos.</Text>
        ) : (
          <DataTable columns={colsTop} rows={resumen.top_deudores} />
        )}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Top 5 proveedores con saldo vencido por moneda</Text>
        {resumen.top_acreedores.length === 0 ? (
          <Text style={styles.emptyState}>Sin proveedores con facturas vencidas.</Text>
        ) : (
          <DataTable columns={colsTop} rows={resumen.top_acreedores} />
        )}

        <ReportContext>
          <Text style={styles.contextText}>Días vencidos: mayor atraso de las facturas agrupadas por nombre y moneda.</Text>
        </ReportContext>

        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
