/**
 * PDF del libro maestro de pagos (Tesorería → Pagos).
 * Lista de cobros de clientes, pagos a proveedores y anticipos del periodo.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { COLORS } from "@/pdf/theme/tokens";

/** Fila ya formateada (contrato local del PDF, sin depender del feature). */
export interface FilaLibroPagosExport {
  fecha: string;
  tipo: string;
  contraparte: string;
  documento: string;
  metodo: string;
  referencia: string;
  cuenta: string;
  monto: string;
  tipoCambio: string;
  fuenteTc: string;
  montoMxn: string;
  estado: string;
}

interface ResumenPdf {
  periodo: string;
  cobrado: string;
  pagado: string;
  neto: string;
  conteo: string;
}

interface Props {
  resumen: ResumenPdf;
  filas: FilaLibroPagosExport[];
  emisor?: { razonSocial?: string };
}

const COL_FECHA = { width: 62, flexGrow: 0, flexShrink: 0 } as const;
const COL_TIPO = { width: 62, flexGrow: 0, flexShrink: 0 } as const;
const COL_ESTADO = { width: 70, flexGrow: 0, flexShrink: 0 } as const;

const cols: PdfColumn<FilaLibroPagosExport>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_FECHA, render: (r) => r.fecha },
  { key: "tipo", title: "Tipo", cellStyle: COL_TIPO, render: (r) => r.tipo },
  { key: "contraparte", title: "Cliente / Proveedor", cellStyle: styles.cellDesc, render: (r) => r.contraparte },
  { key: "documento", title: "Documento", cellStyle: styles.cellDesc, render: (r) => r.documento },
  { key: "metodo", title: "Método", cellStyle: styles.cellDesc, render: (r) => r.metodo },
  { key: "referencia", title: "Referencia", cellStyle: styles.cellDesc, render: (r) => r.referencia },
  { key: "cuenta", title: "Cuenta", cellStyle: styles.cellDesc, render: (r) => r.cuenta },
  { key: "monto", title: "Monto", cellStyle: styles.cellNumWide, render: (r) => r.monto },
  { key: "tipoCambio", title: "TC", cellStyle: COL_TIPO, render: (r) => r.tipoCambio },
  { key: "montoMxn", title: "Equiv. MXN", cellStyle: styles.cellNumWide, render: (r) => r.montoMxn },
  { key: "estado", title: "Conciliación", cellStyle: COL_ESTADO, render: (r) => r.estado },
];

export function LibroPagosDocument({ resumen, filas, emisor }: Props) {
  return (
    <Document title="Libro de pagos" author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Libro de pagos</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              Cobros de clientes, pagos a proveedores y anticipos
            </Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.subtle }}>
              Periodo {resumen.periodo}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.subtle }}>
              Importes en MXN valuados al tipo de cambio de cada pago
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>Cobrado: {resumen.cobrado}</Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>Pagado: {resumen.pagado}</Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>Neto: {resumen.neto}</Text>
          <Text style={{ fontSize: 9, color: COLORS.muted }}>Pagos: {resumen.conteo}</Text>
        </View>

        {filas.length === 0 ? (
          <Text style={styles.paragraph}>
            No hay pagos registrados en el periodo seleccionado.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
          <Text style={{ fontSize: 9 }}>Total cobrado (MXN): {resumen.cobrado}</Text>
          <Text style={{ fontSize: 9 }}>Total pagado (MXN): {resumen.pagado}</Text>
          <Text style={{ fontSize: 9 }}>Neto (MXN): {resumen.neto}</Text>
          <Text style={{ fontSize: 9 }}>Pagos incluidos: {resumen.conteo}</Text>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
