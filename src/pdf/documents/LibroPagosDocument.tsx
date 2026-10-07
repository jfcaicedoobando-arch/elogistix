/**
 * PDF del libro maestro de pagos (Tesorería → Pagos).
 * Lista de cobros de clientes, pagos a proveedores y anticipos del periodo.
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";

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
  devuelto?: string;
  neto: string;
  conteo: string;
}

interface Props {
  resumen: ResumenPdf;
  filas: FilaLibroPagosExport[];
  emisor?: EmisorInfo;
}

const COL_FECHA = { width: 62, flexGrow: 0, flexShrink: 0 } as const;
const COL_TIPO = { width: 62, flexGrow: 0, flexShrink: 0 } as const;
const COL_ESTADO = { width: 66, flexGrow: 0, flexShrink: 0 } as const;

const cols: PdfColumn<FilaLibroPagosExport>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_FECHA, render: (r) => r.fecha },
  { key: "tipo", title: "Tipo", hyphenate: false, cellStyle: COL_TIPO, render: (r) => r.tipo },
  { key: "contraparte", title: "Cliente / Proveedor", hyphenate: false, cellStyle: { width: 56, flexGrow: 0, flexShrink: 0 }, render: (r) => r.contraparte },
  { key: "documento", title: "Documento", hyphenate: false, cellStyle: { width: 68, flexGrow: 0, flexShrink: 0 }, render: (r) => r.documento },
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
        <ReportHeader title="Libro de pagos" emisor={emisor}>
          <Text style={styles.contextText}>
            Cobros de clientes, pagos a proveedores, anticipos y devoluciones
          </Text>
          <Text style={styles.contextText}>Periodo {resumen.periodo}</Text>
          <Text style={styles.contextText}>
            Importes en MXN al TC guardado; devoluciones al TC del anticipo original
          </Text>
        </ReportHeader>

        <ReportSummary columns={4} items={[
          { label: "Cobrado:", value: resumen.cobrado },
          { label: "Pagado:", value: resumen.pagado },
          { label: "Neto:", value: resumen.neto },
          { label: "Pagos:", value: resumen.conteo },
        ]} />

        {filas.length === 0 ? (
          <Text style={styles.emptyState}>
            No hay pagos registrados en el periodo seleccionado.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <ReportSummary columns={3} items={[
          { label: "Total cobrado (MXN):", value: resumen.cobrado },
          { label: "Total pagado (MXN):", value: resumen.pagado },
          { label: "Devoluciones (MXN):", value: resumen.devuelto ?? "—" },
          { label: "Neto (MXN):", value: resumen.neto },
          { label: "Pagos incluidos:", value: resumen.conteo },
        ]} />

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
