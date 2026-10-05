/**
 * PDF del estado de cuenta bancario (v13.450.0).
 * Lista cronológica de entradas y salidas con saldo corrido.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { COLORS } from "@/pdf/theme/tokens";
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
  emisor?: { razonSocial?: string };
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
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Estado de cuenta</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              {cuenta} · {banco} · {moneda}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.subtle }}>
              Periodo {resumen.periodo}
            </Text>
          </View>
        </View>

        {resumen.cobertura && <Text style={styles.paragraph}>{resumen.cobertura}</Text>}
        <Text style={styles.h3}>Resumen de todo el periodo</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            Saldo inicial: {resumen.saldoInicial}
          </Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            Entradas: {resumen.entradas}
          </Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            Salidas: {resumen.salidas}
          </Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>
            Saldo final: {resumen.saldoFinal}
          </Text>
        </View>

        {alcance && (
          <View style={{ marginBottom: 10 }} wrap={false}>
            <Text style={styles.h3}>Detalle exportado: {alcance.movimientosVisibles} de {alcance.movimientosPeriodo} movimientos</Text>
            <Text style={{ fontSize: 9, color: COLORS.muted }}>{alcance.filtro}</Text>
            <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 3 }}>
              Entradas visibles: {alcance.entradas} | Salidas visibles: {alcance.salidas}
            </Text>
            <Text style={{ fontSize: 8, color: COLORS.subtle, marginTop: 3 }}>
              El saldo de cada fila es el saldo corrido real de la cuenta; incluye movimientos del periodo ocultos por los filtros.
            </Text>
          </View>
        )}

        {filas.length === 0 ? (
          <Text style={styles.paragraph}>
            No hay movimientos en el periodo seleccionado.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <Footer />
      </Page>
    </Document>
  );
}
