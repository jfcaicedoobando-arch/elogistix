/**
 * Ola 2 — Estado de cuenta del proveedor en PDF (contable, conciliable).
 * Recibe filas ya formateadas por
 * `@/features/proveedor/services/estadoCuentaExport` (contrato local).
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";

export interface FilaMovimientoPdf {
  fecha: string;
  tipo: string;
  folio: string;
  expediente: string;
  referencia: string;
  moneda: string;
  cargo: string;
  abono: string;
  saldo: string;
}

export interface FilaAgingPdf {
  moneda: string;
  etiqueta: string;
  saldo: string;
}

export interface FilaSaldoPdf {
  moneda: string;
  cargos: string;
  abonos: string;
  saldo: string;
}

interface Props {
  proveedorNombre: string;
  rfc?: string | null;
  desde: string;
  hasta: string;
  movimientos: FilaMovimientoPdf[];
  aging: FilaAgingPdf[];
  saldos: FilaSaldoPdf[];
  saldoApertura?: { moneda: string; saldo: string }[];
  hayMas?: boolean;
  totalMovimientos?: number;
  emisor?: EmisorInfo;
}

const money = (valor: string, moneda = "MXN") => formatCurrency(Number(valor) || 0, moneda);
const COL_CORTA = { width: 62, flexGrow: 0, flexShrink: 0 } as const;

const colsMov: PdfColumn<FilaMovimientoPdf>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_CORTA, render: (r) => formatDate(r.fecha) },
  { key: "tipo", title: "Movimiento", cellStyle: COL_CORTA, render: (r) => r.tipo },
  { key: "folio", title: "Folio", cellStyle: { ...COL_CORTA, width: 82 }, render: (r) => r.folio, hyphenate: false },
  { key: "exp", title: "Expediente", cellStyle: { ...COL_CORTA, width: 70 }, render: (r) => r.expediente || "—", hyphenate: false },
  { key: "ref", title: "Referencia", cellStyle: { ...COL_CORTA, width: 142 }, render: (r) => r.referencia || "—", hyphenate: false },
  { key: "mon", title: "Mon.", cellStyle: styles.cellQty, render: (r) => r.moneda },
  { key: "cargo", title: "Cargo", cellStyle: styles.cellNumWide, render: (r) => money(r.cargo, r.moneda) },
  { key: "abono", title: "Abono", cellStyle: styles.cellNumWide, render: (r) => money(r.abono, r.moneda) },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => money(r.saldo, r.moneda) },
];

const colsAging: PdfColumn<FilaAgingPdf>[] = [
  { key: "moneda", title: "Moneda", cellStyle: COL_CORTA, render: (r) => r.moneda },
  { key: "etiqueta", title: "Antigüedad", cellStyle: styles.cellDesc, render: (r) => r.etiqueta },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => money(r.saldo, r.moneda) },
];

const colsSaldos: PdfColumn<FilaSaldoPdf>[] = [
  { key: "moneda", title: "Moneda", cellStyle: { ...COL_CORTA, width: "16%" }, render: (r) => r.moneda },
  { key: "cargos", title: "Cargos", cellStyle: [styles.cellNumWide, { width: "28%" }], render: (r) => money(r.cargos, r.moneda) },
  { key: "abonos", title: "Abonos", cellStyle: [styles.cellNumWide, { width: "28%" }], render: (r) => money(r.abonos, r.moneda) },
  { key: "saldo", title: "Saldo global", cellStyle: [styles.cellNumWide, { width: "28%" }], render: (r) => money(r.saldo, r.moneda) },
];

export function EstadoCuentaProveedorDocument({
  proveedorNombre, rfc, desde, hasta, movimientos, aging, saldos, emisor,
  saldoApertura = [], hayMas = false, totalMovimientos,
}: Props) {
  return (
    <Document
      title={`Estado de cuenta ${proveedorNombre}`}
      author={emisor?.organizacionNombre || emisor?.razonSocial || "Libre Carga"}
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Estado de cuenta de proveedor" emisor={emisor}>
          <Text style={styles.contextText}>{proveedorNombre}</Text>
          {rfc ? <Text style={styles.contextText}>RFC / Tax ID: {rfc}</Text> : null}
          <Text style={styles.contextText}>Periodo: {formatDate(desde)} al {formatDate(hasta)}</Text>
          <Text style={styles.contextText}>Saldos por moneda nativa; no se suman divisas distintas.</Text>
        </ReportHeader>

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 10 }]}>Resumen global por moneda</Text>
        <ReportContext>
          <Text style={styles.contextText}>
            Saldo global al día de hoy (sin filtro de periodo). No representa el cierre del periodo seleccionado.
          </Text>
        </ReportContext>
        {saldos.length === 0 ? (
          <Text style={styles.emptyState}>Sin saldos globales registrados.</Text>
        ) : (
          <DataTable columns={colsSaldos} rows={saldos} />
        )}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 10 }]}>Antigüedad de saldos por pagar al día de hoy</Text>
        {aging.length === 0 ? (
          <Text style={styles.emptyState}>Sin saldos pendientes.</Text>
        ) : (
          <DataTable columns={colsAging} rows={aging} />
        )}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 10 }]}>Saldo inicial del periodo</Text>
        <Text style={styles.paragraph}>Antes del {formatDate(desde)}:</Text>
        {saldoApertura.length === 0 ? (
          <Text style={styles.emptyState}>Sin saldo previo al periodo (saldo inicial cero).</Text>
        ) : saldoApertura.map((s) => (
          <Text key={s.moneda} style={styles.paragraph}>
            {s.moneda}: {money(s.saldo, s.moneda)}
          </Text>
        ))}

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 10 }]}>Movimientos del periodo seleccionado</Text>
        {hayMas && (
          <ReportContext>
            <Text style={styles.contextText}>
              Detalle parcial: {movimientos.length} de {totalMovimientos ?? "más"} movimientos.
              Acota el periodo para consultar el detalle completo.
            </Text>
          </ReportContext>
        )}
        {movimientos.length === 0 ? (
          <Text style={styles.emptyState}>Sin movimientos en el periodo.</Text>
        ) : (
          <DataTable columns={colsMov} rows={movimientos} />
        )}

        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
