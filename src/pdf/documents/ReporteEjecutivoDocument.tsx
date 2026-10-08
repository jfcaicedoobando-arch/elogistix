/**
 * Reporte PDF: Dashboard Ejecutivo Financiero (Sprint 6).
 *
 * Contrato de maquetación multi-página (12.61.10):
 * - `ReportHeader` aporta la banda corporativa fija compartida y `Footer`
 *   aporta el pie fijo. El encabezado y su contexto aparecen sólo en página 1.
 * - `DataTable.tableHeader fixed` se repite automáticamente cuando una tabla
 *   (top deudores/acreedores/alertas) cruza páginas.
 * - El `paddingTop: 40` de `styles.page` garantiza resguardo superior uniforme
 *   en TODAS las páginas (secundarias incluidas) bajo la banda corporativa.
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatFechaHora } from "@/lib/formatters";

import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { SnapshotEjecutivo } from "@/features/dashboardEjecutivo/services";
import type { ResumenCuenta, TopItem } from "@/features/tesoreria/services";
import type { AlertaEjecutiva } from "@/features/dashboardEjecutivo/services";

interface Props {
  snapshot: SnapshotEjecutivo;
  emisor?: EmisorInfo;
}

const cuentaCols: PdfColumn<ResumenCuenta>[] = [
  { key: "cuenta", title: "Cuenta", cellStyle: styles.cellDesc, render: (c) => `${c.alias} — ${c.banco}` },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (c) => formatCurrency(c.saldo, c.moneda) },
];

const topCols: PdfColumn<TopItem>[] = [
  { key: "n", title: "Nombre", cellStyle: styles.cellDesc, render: (r) => r.nombre },
  { key: "s", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => formatCurrency(r.saldo, r.moneda) },
  { key: "d", title: "Días", cellStyle: styles.cellQty, render: (r) => r.dias != null ? String(r.dias) : "—" },
];

const alertaCols: PdfColumn<AlertaEjecutiva>[] = [
  { key: "sev", title: "Sev.", cellStyle: [styles.cellQty, { width: 60 }], render: (r) => r.severidad },
  { key: "t", title: "Título", cellStyle: styles.cellDesc, render: (r) => r.titulo },
  { key: "d", title: "Detalle", cellStyle: styles.cellDesc, render: (r) => r.descripcion },
];

export function ReporteEjecutivoDocument({ snapshot, emisor }: Props) {
  const { kpis } = snapshot;
  const fuente = snapshot.fuente === "facturas" ? "Facturas (devengada)" : "Embarques (operativa)";
  const criterio = snapshot.fuente === "facturas"
    ? "Bases sin IVA: facturas por fecha fiscal (timbre en hora de México o emisión), CxP por emisión y notas de crédito vigentes por emisión, restadas sobre su base."
    : "Bases sin IVA: ventas facturadas netas de notas de crédito y conceptos de costo de embarques contables cuya ETA cae en el periodo.";
  return (
    <Document title={`Dashboard Ejecutivo ${snapshot.periodo} - ${fuente}`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <ReportHeader title="Dashboard Ejecutivo" emisor={emisor}>
          <Text style={styles.contextText}>
            Periodo: {snapshot.periodo} · Generado: {formatFechaHora(snapshot.generadoEn)}
          </Text>
          <Text style={styles.contextText}>Fuente EERR: {fuente}</Text>
          <Text style={styles.contextText}>{criterio}</Text>
          <Text style={styles.contextText}>
            EERR en MXN con el tipo de cambio fiscal/operativo disponible y respaldo DOF cuando corresponde.
            Bancos y cartera al {snapshot.vencimientos.fechaReferencia}; listas en moneda original.
            TC de saldos USD: {snapshot.tipoCambioUsd.toFixed(4)} MXN/USD
            {snapshot.tesoreria.tipo_cambio_fecha ? ` (${snapshot.tesoreria.tipo_cambio_fecha})` : ""}
            {snapshot.tcEsFallback ? " - respaldo estimado, sólo referencia." : "."}
          </Text>
        </ReportHeader>

        <ReportSummary columns={4} items={[
          { label: "Ingresos", value: formatCurrency(kpis.ingresos_mxn, "MXN") },
          { label: "Utilidad", value: formatCurrency(kpis.utilidad_mxn, "MXN") },
          { label: "Margen", value: `${kpis.margen_pct.toFixed(1)}%` },
          { label: "Bancos", value: formatCurrency(kpis.saldo_bancos_mxn, "MXN") },
        ]} />

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Saldos bancarios</Text>
        {snapshot.tesoreria.cuentas.length === 0 ? (
          <Text style={styles.emptyState}>Sin cuentas activas.</Text>
        ) : (
          <DataTable columns={cuentaCols} rows={snapshot.tesoreria.cuentas} />
        )}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Top deudores</Text>
        {snapshot.topDeudores.length === 0
          ? <Text style={styles.emptyState}>Sin cartera vencida.</Text>
          : <DataTable columns={topCols} rows={snapshot.topDeudores} />}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Top acreedores</Text>
        {snapshot.topAcreedores.length === 0
          ? <Text style={styles.emptyState}>Sin CxP pendiente.</Text>
          : <DataTable columns={topCols} rows={snapshot.topAcreedores} />}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 12 }]}>Alertas</Text>
        {snapshot.alertas.length === 0
          ? <Text style={styles.emptyState}>Sin alertas activas.</Text>
          : <DataTable columns={alertaCols} rows={snapshot.alertas} />}

        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
