import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { ResumenTesoreria, ResumenCuenta, TopItem } from "@/features/tesoreria/services";
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

export function ReporteTesoreriaDocument({ fechaCorte, resumen, emisor }: Props) {
  const f = resumen.flujo;
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
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Por cobrar MXN</Text>
              <Text style={styles.kpiValue}>{formatCurrency(f.por_cobrar_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Por pagar MXN</Text>
              <Text style={styles.kpiValue}>{formatCurrency(f.por_pagar_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Flujo neto MXN</Text>
              <Text style={styles.kpiValue}>{formatCurrency(f.flujo_neto_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Flujo neto USD</Text>
              <Text style={styles.kpiValue}>{formatCurrency(f.flujo_neto_usd, "USD")}</Text>
            </View>
          </View>
        </View>

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
