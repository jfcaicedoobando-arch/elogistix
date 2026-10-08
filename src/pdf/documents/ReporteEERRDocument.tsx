import { avisoNcProveedorSinBase } from "@/lib/financial/baseNcProveedor";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { ReportHeader } from "@/pdf/components/ReportHeader";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { ReportSummary } from "@/pdf/components/ReportSummary";
import { ReportContext } from "@/pdf/components/ReportContext";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { EstadoResultados, ModoColumna, FilaER } from "@/features/profit/domain/estadoResultados";

interface Props {
  periodo: string; // YYYY-MM
  fuente: "embarques" | "facturas";
  data: EstadoResultados;
  emisor?: EmisorInfo;
}

const MODOS: ModoColumna[] = ["Marítimo", "Aéreo", "Terrestre", "Otros"];

type FilaPlana = {
  concepto: string;
  total: number;
  maritimo: number;
  aereo: number;
  terrestre: number;
  otros: number;
};

function aplanar(filas: FilaER[]): FilaPlana[] {
  return filas.map((f) => ({
    concepto: f.concepto,
    total: f.total,
    maritimo: f.porModo["Marítimo"] ?? 0,
    aereo: f.porModo["Aéreo"] ?? 0,
    terrestre: f.porModo["Terrestre"] ?? 0,
    otros: f.porModo["Otros"] ?? 0,
  }));
}

const cols: PdfColumn<FilaPlana>[] = [
  { key: "desc", title: "Concepto", cellStyle: styles.cellDesc, render: (r) => r.concepto },
  { key: "mar", title: "Marítimo", cellStyle: [styles.cellNumWide, { width: 100 }], render: (r) => formatCurrency(r.maritimo, "MXN") },
  { key: "aer", title: "Aéreo", cellStyle: [styles.cellNumWide, { width: 100 }], render: (r) => formatCurrency(r.aereo, "MXN") },
  { key: "ter", title: "Terrestre", cellStyle: [styles.cellNumWide, { width: 100 }], render: (r) => formatCurrency(r.terrestre, "MXN") },
  { key: "otr", title: "Otros", cellStyle: [styles.cellNumWide, { width: 100 }], render: (r) => formatCurrency(r.otros, "MXN") },
  { key: "tot", title: "Total", cellStyle: [styles.cellNumWide, { width: 100 }], render: (r) => formatCurrency(r.total, "MXN") },
];

export function ReporteEERRDocument({ periodo, fuente, data, emisor }: Props) {
  const ingresos = aplanar(data.ingresos);
  const costos = aplanar(data.costos);
  const utilidadModos = MODOS.map((m) => data.utilidad.porModo[m] ?? 0);
  const resumenModos = (
    <View style={[styles.summaryBox, { padding: 7, marginTop: 6 }]} wrap={false}>
      <Text style={styles.contextText}>
        Utilidad por modo: Marítimo {formatCurrency(utilidadModos[0], "MXN")} ·
        Aéreo {formatCurrency(utilidadModos[1], "MXN")} ·
        Terrestre {formatCurrency(utilidadModos[2], "MXN")} ·
        Otros {formatCurrency(utilidadModos[3], "MXN")}
      </Text>
    </View>
  );

  return (
    <Document title={`EERR ${periodo}`} author={emisor?.organizacionNombre || emisor?.razonSocial || "Libre Carga"}>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <ReportHeader title="Estado de Resultados" emisor={emisor}>
          <Text style={styles.contextText}>
            Periodo: {periodo} · Fuente: {fuente === "facturas" ? "Devengada (facturas)" : "Operativa (ETA)"}
          </Text>
        </ReportHeader>

        {!!data.notas_proveedor_sin_base?.length && (
          <ReportContext>
            <Text style={styles.contextText}>{avisoNcProveedorSinBase(data.notas_proveedor_sin_base.length)}</Text>
          </ReportContext>
        )}
        <ReportSummary columns={4} items={[
          { label: "Ingresos totales", value: formatCurrency(data.totalIngresos.total, "MXN") },
          { label: "Costos totales", value: formatCurrency(data.totalCostos.total, "MXN") },
          { label: "Utilidad bruta", value: formatCurrency(data.utilidad.total, "MXN") },
          { label: "Margen", value: `${data.margen.total.toFixed(1)}%` },
        ]} />

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 8 }]}>Ingresos</Text>
        <DataTable columns={cols} rows={ingresos} />

        <Text minPresenceAhead={70} style={[styles.h3, { marginTop: 8 }]}>Costos</Text>
        <DataTable columns={cols} rows={costos} afterLastRow={resumenModos} />


        <Footer emisor={emisor} empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
