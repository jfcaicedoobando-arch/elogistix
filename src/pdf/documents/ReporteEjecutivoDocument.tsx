/**
 * Reporte PDF: Dashboard Ejecutivo Financiero (Sprint 6).
 *
 * Contrato de maquetación multi-página (12.61.10):
 * - Únicos elementos `fixed` a nivel raíz de `<Page>`: `topBand` y `Footer`.
 * - El header inline (título + periodo) NO es `fixed` — sólo página 1.
 * - `DataTable.tableHeader fixed` se repite automáticamente cuando una tabla
 *   (top deudores/acreedores/alertas) cruza páginas.
 * - El `paddingTop: 40` de `styles.page` garantiza resguardo superior uniforme
 *   en TODAS las páginas (secundarias incluidas) bajo la banda corporativa.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatFechaHora } from "@/lib/formatters";

import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { SnapshotEjecutivo } from "@/features/dashboardEjecutivo/services";
import type { TopItem } from "@/features/tesoreria/services";
import type { AlertaEjecutiva } from "@/features/dashboardEjecutivo/services";
import { COLORS } from "@/pdf/theme/tokens";

interface Props {
  snapshot: SnapshotEjecutivo;
}

const topCols: PdfColumn<TopItem>[] = [
  { key: "n", title: "Nombre", cellStyle: styles.cellDesc, render: (r) => r.nombre },
  { key: "s", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.saldo, r.moneda) },
  { key: "d", title: "Días", cellStyle: styles.cellQty, render: (r) => r.dias != null ? String(r.dias) : "—" },
];

const alertaCols: PdfColumn<AlertaEjecutiva>[] = [
  { key: "sev", title: "Sev.", cellStyle: styles.cellQty, render: (r) => r.severidad },
  { key: "t", title: "Título", cellStyle: styles.cellDesc, render: (r) => r.titulo },
  { key: "d", title: "Detalle", cellStyle: styles.cellDesc, render: (r) => r.descripcion },
];

export function ReporteEjecutivoDocument({ snapshot }: Props) {
  const { kpis } = snapshot;
  return (
    <Document title={`Dashboard Ejecutivo ${snapshot.periodo}`} author="Libre Carga">
      <Page size="LETTER" style={styles.page}>
        {/* Banda corporativa repetida en TODAS las páginas (raíz de Page). */}
        <View style={styles.topBand} fixed />
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Dashboard Ejecutivo</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              Periodo: {snapshot.periodo} · Generado: {formatFechaHora(snapshot.generadoEn)}
            </Text>
          </View>
        </View>

        <View style={[styles.kpiRow, { marginTop: 8 }]}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Ingresos</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.ingresos_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Utilidad</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.utilidad_mxn, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Margen</Text>
              <Text style={styles.kpiValue}>{kpis.margen_pct.toFixed(1)}%</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Bancos</Text>
              <Text style={styles.kpiValue}>{formatCurrency(kpis.saldo_bancos_mxn, "MXN")}</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 12 }]}>Saldos bancarios</Text>
        {snapshot.tesoreria.cuentas.length === 0 ? (
          <Text style={styles.paragraph}>Sin cuentas activas.</Text>
        ) : (
          <View>
            {snapshot.tesoreria.cuentas.map((c) => (
              <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                <Text style={{ fontSize: 10 }}>{c.alias} — {c.banco}</Text>
                <Text style={{ fontSize: 10 }}>{formatCurrency(c.saldo, c.moneda)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.h3, { marginTop: 12 }]}>Top deudores</Text>
        {snapshot.topDeudores.length === 0
          ? <Text style={styles.paragraph}>Sin cartera vencida.</Text>
          : <DataTable columns={topCols} rows={snapshot.topDeudores} />}

        <Text style={[styles.h3, { marginTop: 12 }]}>Top acreedores</Text>
        {snapshot.topAcreedores.length === 0
          ? <Text style={styles.paragraph}>Sin CxP pendiente.</Text>
          : <DataTable columns={topCols} rows={snapshot.topAcreedores} />}

        <Text style={[styles.h3, { marginTop: 12 }]}>Alertas</Text>
        {snapshot.alertas.length === 0
          ? <Text style={styles.paragraph}>Sin alertas activas.</Text>
          : <DataTable columns={alertaCols} rows={snapshot.alertas} />}

        <Footer />
      </Page>
    </Document>
  );
}
