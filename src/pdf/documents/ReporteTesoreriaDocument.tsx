import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { ResumenTesoreria, ResumenCuenta, TopItem } from "@/features/tesoreria/services";
import { renglonesFlujoMonedas, type RenglonFlujoMoneda } from "@/features/tesoreria/domain";
import { COLORS } from "@/pdf/theme/tokens";

interface Props {
  fechaCorte: string;
  resumen: ResumenTesoreria;
  emisor?: { razonSocial?: string };
}

const colsCuentas: PdfColumn<ResumenCuenta>[] = [
  { key: "alias", title: "Cuenta", cellStyle: styles.cellDesc, render: (r) => `${r.banco} · ${r.alias}` },
  { key: "mon", title: "Moneda", cellStyle: styles.cellQty, render: (r) => r.moneda },
  { key: "saldo", title: "Saldo actual", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.saldo, r.moneda) },
];

const colsTop: PdfColumn<TopItem>[] = [
  { key: "nom", title: "Nombre", cellStyle: styles.cellDesc, render: (r) => r.nombre },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.saldo, r.moneda) },
  { key: "dias", title: "Días", cellStyle: styles.cellQty, render: (r) => r.dias != null ? String(r.dias) : "—" },
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
    <Document title={`Tesorería ${fechaCorte}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Resumen de Tesorería</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>Corte: {formatDate(fechaCorte)}</Text>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 8 }]}>Saldos en bancos</Text>
        {resumen.cuentas.length === 0 ? (
          <Text style={styles.paragraph}>Sin cuentas bancarias configuradas.</Text>
        ) : (
          <DataTable columns={colsCuentas} rows={resumen.cuentas} />
        )}

        <Text style={[styles.h3, { marginTop: 12 }]}>Flujo esperado 30 días</Text>
        <DataTable columns={colsFlujo} rows={flujo} />

        <Text style={[styles.h3, { marginTop: 12 }]}>Top 5 deudores vencidos</Text>
        {resumen.top_deudores.length === 0 ? (
          <Text style={styles.paragraph}>Sin deudores vencidos.</Text>
        ) : (
          <DataTable columns={colsTop} rows={resumen.top_deudores} />
        )}

        <Text style={[styles.h3, { marginTop: 12 }]}>Top 5 vencimientos próximos a proveedor</Text>
        {resumen.top_acreedores.length === 0 ? (
          <Text style={styles.paragraph}>Sin vencimientos próximos.</Text>
        ) : (
          <DataTable columns={colsTop} rows={resumen.top_acreedores} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
