/**
 * PDF del estado de cuenta bancario (v13.450.0).
 * Lista cronológica de entradas y salidas con saldo corrido.
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
/** Fila ya formateada (contrato local del PDF, sin depender del feature). */
export interface FilaEstadoCuentaExport {
  fecha: string;
  concepto: string;
  referencia: string;
  salida: string;
  entrada: string;
  saldo: string;
  estado: string;
}

interface ResumenPdf {
  periodo: string;
  cobertura?: string | null;
  saldoInicial: string;
  entradas: string;
  salidas: string;
  saldoFinal: string;
}

interface Props {
  cuenta: string;
  banco: string;
  moneda: string;
  resumen: ResumenPdf;
  filas: FilaEstadoCuentaExport[];
  alcance?: {
    filtro: string;
    movimientosVisibles: number;
    movimientosPeriodo: number;
    entradas: string;
    salidas: string;
  };
  emisor?: EmisorInfo;
}

const COL_FECHA = { width: 70, flexGrow: 0, flexShrink: 0 } as const;
const COL_ESTADO = { width: 75, flexGrow: 0, flexShrink: 0 } as const;

const cols: PdfColumn<FilaEstadoCuentaExport>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_FECHA, render: (r) => r.fecha },
  { key: "concepto", title: "Concepto", cellStyle: styles.cellDesc, render: (r) => r.concepto },
  { key: "referencia", title: "Referencia", cellStyle: styles.cellDesc, render: (r) => r.referencia },
  { key: "salida", title: "Salida", cellStyle: styles.cellNumWide, render: (r) => r.salida },
  { key: "entrada", title: "Entrada", cellStyle: styles.cellNumWide, render: (r) => r.entrada },
  { key: "saldo", title: "Saldo", cellStyle: styles.cellNumWide, render: (r) => r.saldo },
  { key: "estado", title: "Estado", cellStyle: COL_ESTADO, render: (r) => r.estado },
];

export function EstadoCuentaBancarioDocument({
  cuenta, banco, moneda, resumen, filas, alcance, emisor,
}: Props) {
  return (
    <Document
      title={`Estado de cuenta ${cuenta}`}
      author={emisor?.razonSocial ?? "Libre Carga"}
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Estado de cuenta" emisor={emisor}>
          <Text style={styles.contextText}>{cuenta} · {banco} · {moneda}</Text>
          <Text style={styles.contextText}>Periodo {resumen.periodo}</Text>
        </ReportHeader>

        {resumen.cobertura && (
          <ReportContext><Text style={styles.contextText}>{resumen.cobertura}</Text></ReportContext>
        )}
        <Text minPresenceAhead={70} style={styles.h3}>Resumen de todo el periodo</Text>
        <ReportSummary columns={4} items={[
          { label: "Saldo inicial:", value: resumen.saldoInicial },
          { label: "Entradas:", value: resumen.entradas },
          { label: "Salidas:", value: resumen.salidas },
          { label: "Saldo final:", value: resumen.saldoFinal },
        ]} />

        {alcance && (
          <ReportContext>
            <Text minPresenceAhead={70} style={styles.h3}>Detalle exportado: {alcance.movimientosVisibles} de {alcance.movimientosPeriodo} movimientos</Text>
            <Text style={styles.contextText}>{alcance.filtro}</Text>
            <Text style={styles.contextText}>
              Entradas visibles: {alcance.entradas} | Salidas visibles: {alcance.salidas}
            </Text>
            <Text style={styles.contextText}>
              El saldo de cada fila es el saldo corrido real de la cuenta; incluye movimientos del periodo ocultos por los filtros.
            </Text>
          </ReportContext>
        )}

        {filas.length === 0 ? (
          <Text style={styles.emptyState}>
            No hay movimientos en el periodo seleccionado.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
