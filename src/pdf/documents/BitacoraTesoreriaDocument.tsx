/**
 * PDF de la bitácora de tesorería de una factura de proveedor (v13.397.0).
 * Lista los movimientos generados al registrar, editar o eliminar pagos.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { FilaBitacoraExport } from "@/features/cxp/services/bitacoraTesoreriaExport";

interface Props {
  folio: string;
  proveedor?: string;
  /** Descripción de los filtros aplicados, si los hay. */
  filtrosAplicados?: string;
  filas: FilaBitacoraExport[];
  emisor?: { razonSocial?: string };
}

const COL_FECHA = { width: 95, flexGrow: 0, flexShrink: 0 } as const;
const COL_MOV = { width: 90, flexGrow: 0, flexShrink: 0 } as const;
const COL_ESTADO = { width: 115, flexGrow: 0, flexShrink: 0 } as const;

const cols: PdfColumn<FilaBitacoraExport>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_FECHA, render: (r) => r.fecha },
  { key: "mov", title: "Movimiento", cellStyle: COL_MOV, render: (r) => r.movimiento },
  { key: "monto", title: "Monto", cellStyle: styles.cellNumWide, render: (r) => r.monto },
  { key: "cargo", title: "Cargo MXN", cellStyle: styles.cellNumWide, render: (r) => r.cargoMxn },
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
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Bitácora de tesorería</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              Factura {folio}
              {proveedor ? ` · ${proveedor}` : ""}
            </Text>
            {filtrosAplicados ? (
              <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.subtle }}>
                {filtrosAplicados}
              </Text>
            ) : null}
          </View>
        </View>

        {filas.length === 0 ? (
          <Text style={styles.paragraph}>
            No hay movimientos de tesorería para mostrar con los filtros seleccionados.
          </Text>
        ) : (
          <DataTable columns={cols} rows={filas} />
        )}

        <Text style={[styles.paragraph, { marginTop: 10, fontSize: 9, color: COLORS.subtle }]}>
          {filas.length} movimiento{filas.length === 1 ? "" : "s"} incluido
          {filas.length === 1 ? "" : "s"} en este reporte.
        </Text>

        <Footer />
      </Page>
    </Document>
  );
}
