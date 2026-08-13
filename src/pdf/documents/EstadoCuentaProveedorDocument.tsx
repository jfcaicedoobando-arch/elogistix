/**
 * Ola 2 — Estado de cuenta del proveedor en PDF (contable, conciliable).
 * Recibe filas ya formateadas por
 * `@/features/proveedor/services/estadoCuentaExport` (contrato local).
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import { COLORS } from "@/pdf/theme/tokens";

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
  emisor?: { razonSocial?: string };
}

const money = (valor: string, moneda = "MXN") => formatCurrency(Number(valor) || 0, moneda);
const COL_CORTA = { width: 62, flexGrow: 0, flexShrink: 0 } as const;

const colsMov: PdfColumn<FilaMovimientoPdf>[] = [
  { key: "fecha", title: "Fecha", cellStyle: COL_CORTA, render: (r) => formatDate(r.fecha) },
  { key: "tipo", title: "Movimiento", cellStyle: COL_CORTA, render: (r) => r.tipo },
  { key: "folio", title: "Folio", cellStyle: COL_CORTA, render: (r) => r.folio },
  { key: "exp", title: "Expediente", cellStyle: COL_CORTA, render: (r) => r.expediente || "—" },
  { key: "ref", title: "Referencia", cellStyle: styles.cellDesc, render: (r) => r.referencia || "—" },
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
  { key: "moneda", title: "Moneda", cellStyle: COL_CORTA, render: (r) => r.moneda },
  { key: "cargos", title: "Cargos", cellStyle: styles.cellNumWide, render: (r) => money(r.cargos, r.moneda) },
  { key: "abonos", title: "Abonos", cellStyle: styles.cellNumWide, render: (r) => money(r.abonos, r.moneda) },
  { key: "saldo", title: "Saldo final", cellStyle: styles.cellNumWide, render: (r) => money(r.saldo, r.moneda) },
];

export function EstadoCuentaProveedorDocument({
  proveedorNombre, rfc, desde, hasta, movimientos, aging, saldos, emisor,
}: Props) {
  return (
    <Document
      title={`Estado de cuenta ${proveedorNombre}`}
      author={emisor?.razonSocial ?? "Libre Carga"}
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Estado de cuenta de proveedor</Text>
            <Text style={{ marginTop: 4, fontSize: 10 }}>{proveedorNombre}</Text>
            {rfc ? (
              <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>
                RFC / Tax ID: {rfc}
              </Text>
            ) : null}
            <Text style={{ marginTop: 2, fontSize: 9, color: COLORS.muted }}>
              Periodo: {formatDate(desde)} al {formatDate(hasta)}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 8, color: COLORS.muted }}>
              Saldos por moneda nativa; no se suman divisas distintas.
            </Text>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 10 }]}>Resumen por moneda</Text>
        {saldos.length === 0 ? (
          <Text style={styles.paragraph}>Sin movimientos en el periodo.</Text>
        ) : (
          <DataTable columns={colsSaldos} rows={saldos} />
        )}

        <Text style={[styles.h3, { marginTop: 10 }]}>Antigüedad de saldos por pagar</Text>
        {aging.length === 0 ? (
          <Text style={styles.paragraph}>Sin saldos pendientes.</Text>
        ) : (
          <DataTable columns={colsAging} rows={aging} />
        )}

        <Text style={[styles.h3, { marginTop: 10 }]}>Movimientos</Text>
        {movimientos.length === 0 ? (
          <Text style={styles.paragraph}>Sin movimientos en el periodo.</Text>
        ) : (
          <DataTable columns={colsMov} rows={movimientos} />
        )}

        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
