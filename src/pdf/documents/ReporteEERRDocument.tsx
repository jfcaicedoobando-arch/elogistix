import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/formatters";
import { styles } from "@/pdf/theme/styles";
import { Footer } from "@/pdf/components/Footer";
import { DataTable, type PdfColumn } from "@/pdf/components/DataTable";
import type { EstadoResultados, ModoColumna, FilaER } from "@/features/profit/domain/estadoResultados";

interface Props {
  periodo: string; // YYYY-MM
  fuente: "embarques" | "facturas";
  data: EstadoResultados;
  emisor?: { razonSocial?: string };
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
  { key: "mar", title: "Marítimo", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.maritimo, "MXN") },
  { key: "aer", title: "Aéreo", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.aereo, "MXN") },
  { key: "ter", title: "Terrestre", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.terrestre, "MXN") },
  { key: "otr", title: "Otros", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.otros, "MXN") },
  { key: "tot", title: "Total", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.total, "MXN") },
];

export function ReporteEERRDocument({ periodo, fuente, data, emisor }: Props) {
  const ingresos = aplanar(data.ingresos);
  const costos = aplanar(data.costos);
  const utilidadModos = MODOS.map((m) => data.utilidad.porModo[m] ?? 0);

  return (
    <Document title={`EERR ${periodo}`} author={emisor?.razonSocial ?? "Libre Carga"}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Estado de Resultados</Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: COLORS.muted }}>
              Periodo: {periodo} · Fuente: {fuente === "facturas" ? "Devengada (facturas)" : "Operativa (ETA)"}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Ingresos totales</Text>
              <Text style={styles.kpiValue}>{formatCurrency(data.totalIngresos.total, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Costos totales</Text>
              <Text style={styles.kpiValue}>{formatCurrency(data.totalCostos.total, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Utilidad bruta</Text>
              <Text style={styles.kpiValue}>{formatCurrency(data.utilidad.total, "MXN")}</Text>
            </View>
          </View>
          <View style={styles.kpiCard}>
            <View style={styles.kpiInner}>
              <Text style={styles.kpiLabel}>Margen</Text>
              <Text style={styles.kpiValue}>{data.margen.total.toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.h3, { marginTop: 12 }]}>Ingresos</Text>
        <DataTable columns={cols} rows={ingresos} />

        <Text style={[styles.h3, { marginTop: 12 }]}>Costos</Text>
        <DataTable columns={cols} rows={costos} />

        <View style={{ marginTop: 12, padding: 8, backgroundColor: COLORS.zebra, borderRadius: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>
            Utilidad por modo: Marítimo {formatCurrency(utilidadModos[0], "MXN")} ·
            Aéreo {formatCurrency(utilidadModos[1], "MXN")} ·
            Terrestre {formatCurrency(utilidadModos[2], "MXN")} ·
            Otros {formatCurrency(utilidadModos[3], "MXN")}
          </Text>
        </View>


        <Footer empresaNombre={emisor?.razonSocial} />
      </Page>
    </Document>
  );
}
