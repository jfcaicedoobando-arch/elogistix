/**
 * Documento PDF para cotización informativa (tarifario).
 * Lista comparativa de tarifas con vigencia global.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CotizacionRow } from "@/types/cotizacion";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { BillToBlock } from "../components/BillToBlock";
import { Footer } from "../components/Footer";
import { DataTable, type PdfColumn } from "../components/DataTable";
import { parseTarifasInformativas } from "@/services/cotizacion";
import type { TarifaInformativa } from "@/types/cotizacion";

interface Props {
  cotizacion: CotizacionRow;
  emisor?: EmisorInfo;
}

function rutaDe(t: TarifaInformativa): string {
  if (t.modo === "Terrestre" && t.modalidad_equipo === "Porta Contenedor" && t.punto_intermedio) {
    return `${t.origen} → ${t.punto_intermedio} → ${t.destino}`;
  }
  return `${t.origen} → ${t.destino}`;
}

function columnas(): PdfColumn<TarifaInformativa>[] {
  return [
    { key: "modo", title: "Modo", cellStyle: { width: 60, fontSize: 9 } as never, render: (r) => r.modo },
    { key: "modalidad", title: "Modalidad / Equipo", cellStyle: { width: 90, fontSize: 9 } as never,
      render: (r) => r.modalidad_equipo || r.tipo_contenedor || "—" },
    { key: "ruta", title: "Ruta", cellStyle: styles.cellDesc, render: (r) => rutaDe(r) },
    { key: "unidad", title: "Unidad", cellStyle: { width: 70, fontSize: 9 } as never, render: (r) => r.unidad_medida },
    { key: "precio", title: "Precio", cellStyle: styles.cellNum, render: (r) => formatCurrency(r.precio, r.moneda) },
    { key: "notas", title: "Notas", cellStyle: { width: 110, fontSize: 9 } as never, render: (r) => r.notas || "—" },
  ];
}

export function TarifarioDocument({ cotizacion, emisor }: Props) {
  const tarifas = parseTarifasInformativas(cotizacion.tarifas_informativas);
  const vigenciaTexto = cotizacion.vigencia_desde && cotizacion.vigencia_hasta
    ? `${formatDate(cotizacion.vigencia_desde)} – ${formatDate(cotizacion.vigencia_hasta)}`
    : "—";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          tipoDocumento="Tarifario Informativo"
          folio={cotizacion.folio}
          meta={[
            { label: "Vigencia", value: vigenciaTexto },
            { label: "Emisión", value: formatDate(cotizacion.created_at) },
            { label: "Ejecutivo", value: cotizacion.operador },
          ]}
          emisor={emisor}
        />
        <Text style={styles.notice}>
          Documento informativo sin compromiso comercial. Las tarifas están sujetas a disponibilidad y a los términos vigentes.
        </Text>
        <BillToBlock
          titulo="Cliente"
          destinatario={{ nombre: cotizacion.cliente_nombre }}
        />

        <Text style={styles.h3}>Tarifas vigentes</Text>
        <DataTable columns={columnas()} rows={tarifas} />

        {cotizacion.notas && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Notas y condiciones</Text>
            <Text style={styles.value}>{cotizacion.notas}</Text>
          </View>
        )}

        <Footer />
      </Page>
    </Document>
  );
}
