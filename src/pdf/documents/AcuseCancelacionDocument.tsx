/**
 * AcuseCancelacionDocument — reporte cliente-side de la cancelación de un
 * CFDI, generado a partir de los datos ya guardados en `public.facturas`
 * y del XML de acuse SAT (`acuse_cancelacion_xml`).
 *
 * Nota importante: el documento oficial SAT es el XML. Este PDF es un
 * "recibo impreso" para archivo interno o para compartir con el cliente.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "../theme/styles";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { Footer } from "../components/Footer";
import { KeyValueGrid } from "../components/KeyValueGrid";
import { formatDate } from "@/lib/formatters";

export interface AcuseCancelacionData {
  numero: string;
  uuidFiscal: string | null;
  folioFiscal: string | null;
  serie: string | null;
  clienteNombre: string | null;
  rfcCliente: string | null;
  fechaEmision: string | null;
  motivo: string | null;
  canceladoEn: string | null;
  acuseFecha: string | null;
  acuseStatus: string | null;
}

const MOTIVOS_LABEL: Record<string, string> = {
  "01": "01 · Comprobante emitido con errores con relación",
  "02": "02 · Comprobante emitido con errores sin relación",
  "03": "03 · No se llevó a cabo la operación",
  "04": "04 · Operación nominativa relacionada en factura global",
};

const STATUS_LABEL: Record<string, string> = {
  accepted: "Aceptado por el SAT",
  pending: "Pendiente (SAT aún no emite el acuse)",
};

function motivoLabel(m: string | null): string {
  if (!m) return "—";
  return MOTIVOS_LABEL[m] ?? m;
}
function statusLabel(s: string | null): string {
  if (!s) return "—";
  return STATUS_LABEL[s] ?? s;
}

interface Props {
  data: AcuseCancelacionData;
  emisor?: EmisorInfo;
}

export function AcuseCancelacionDocument({ data, emisor }: Props) {
  const meta = [
    { label: "Emitido", value: data.fechaEmision ? formatDate(data.fechaEmision) : "—" },
    { label: "Cancelado", value: data.canceladoEn ? formatDate(data.canceladoEn) : "—" },
  ];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <BrandHeader
          tipoDocumento="Acuse de cancelación CFDI"
          folio={data.numero}
          meta={meta}
          emisor={emisor}
        />

        <View style={styles.paragraph}>
          <Text style={{ fontSize: 10 }}>
            Este documento resume la cancelación fiscal del CFDI ante el SAT.
            El comprobante oficial es el archivo XML de acuse emitido por el SAT.
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Datos del comprobante</Text>
          <KeyValueGrid
            items={[
              { label: "Serie", value: data.serie ?? "—" },
              { label: "Folio fiscal", value: data.folioFiscal ?? "—" },
              { label: "UUID SAT", value: data.uuidFiscal ?? "—" },
              { label: "Cliente", value: data.clienteNombre ?? "—" },
              { label: "RFC receptor", value: data.rfcCliente ?? "—" },
            ]}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.label}>Cancelación</Text>
          <KeyValueGrid
            items={[
              { label: "Motivo SAT", value: motivoLabel(data.motivo) },
              { label: "Fecha de cancelación", value: data.canceladoEn ? formatDate(data.canceladoEn) : "—" },
              { label: "Estatus del acuse", value: statusLabel(data.acuseStatus) },
              { label: "Fecha del acuse", value: data.acuseFecha ? formatDate(data.acuseFecha) : "—" },
            ]}
          />
        </View>

        <Footer />
      </Page>
    </Document>
  );
}
