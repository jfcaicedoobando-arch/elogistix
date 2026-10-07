/**
 * PDF de la bitácora de tesorería de una factura de proveedor (v13.397.0).
 * Lista los movimientos generados al registrar, editar o eliminar pagos.
 */
import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { ENCABEZADOS_BITACORA_EXPORT, type FilaBitacoraExport } from "@/features/cxp/services";

interface Props {
  folio: string;
  proveedor?: string;
  /** Descripción de los filtros aplicados, si los hay. */
  filtrosAplicados?: string;
  filas: FilaBitacoraExport[];
  emisor?: EmisorInfo;
}

const COL_FECHA = { width: 95, flexGrow: 0, flexShrink: 0 } as const;
const COL_MOV = { width: 90, flexGrow: 0, flexShrink: 0 } as const;
const COL_ESTADO = { width: 115, flexGrow: 0, flexShrink: 0 } as const;

const cols: PdfColumn<FilaBitacoraExport>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_FECHA, render: (r) => r.fecha },
  { key: "mov", title: "Movimiento", cellStyle: COL_MOV, render: (r) => r.movimiento },
  { key: "monto", title: "Monto", cellStyle: styles.cellNumWide, render: (r) => r.monto },
  { key: "cargo", title: ENCABEZADOS_BITACORA_EXPORT[3], cellStyle: styles.cellNumWide, render: (r) => r.cargoMxn },
  { key: "cuenta", title: "Cuenta", cellStyle: styles.cellDesc, render: (r) => r.cuenta },
  { key: "estado", title: "Estado", cellStyle: COL_ESTADO, render: (r) => r.estadoMovimiento },
  { key: "usuario", title: "Usuario", cellStyle: styles.cellDesc, render: (r) => r.usuario },
];

export function BitacoraTesoreriaDocument({
  folio, proveedor, filtrosAplicados, filas, emisor,
}: Props) {
  return (
    <Document
      title={`Bitácora de tesorería ${folio}`}
      author={emisor?.razonSocial ?? "Libre Carga"}
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Bitácora de tesorería" emisor={emisor}>
          <Text style={styles.contextText}>
            Factura {folio}
            {proveedor ? ` · ${proveedor}` : ""}
          </Text>
          {filtrosAplicados ? <Text style={styles.contextText}>{filtrosAplicados}</Text> : null}
        </ReportHeader>

        {filas.length === 0 ? (
          <Text style={styles.emptyState}>
            No hay movimientos de tesorería para mostrar con los filtros seleccionados.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <ReportContext>
          <Text style={styles.contextText}>
            {filas.length} movimiento{filas.length === 1 ? "" : "s"} incluido
            {filas.length === 1 ? "" : "s"} en este reporte.
          </Text>
        </ReportContext>

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
