import { View, Text } from "@react-pdf/renderer";
import { formatDate } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { KeyValueGrid } from "../components/KeyValueGrid";
import { BrandHeader } from "../components/BrandHeader";
import { BillToBlock } from "../components/BillToBlock";
import { PaymentTermsBlock } from "../components/PaymentTermsBlock";
import type { ProformaRow, ClienteLite, EmbarqueLite } from "./proformaShared";

interface Props {
  proforma: ProformaRow;
  cliente: ClienteLite;
  embarque: EmbarqueLite;
  esConsolidada: boolean;
}

function vigenciaPlus30(fechaEmision: string): string {
  try {
    const d = new Date(fechaEmision);
    d.setDate(d.getDate() + 30);
    return formatDate(d.toISOString().substring(0, 10));
  } catch {
    return "—";
  }
}

function SeccionEmbarque({ embarque }: { embarque: EmbarqueLite }) {
  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || "-";
  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || "-";
  return (
    <>
      <Text style={styles.h3}>Datos del Embarque</Text>
      <KeyValueGrid
        columns={3}
        items={[
          ["Modo", embarque.modo],
          ["Tipo", embarque.tipo],
          ["Incoterm", embarque.incoterm],
          ["Origen", origen],
          ["Destino", destino],
          ["Ruta", `${origen} → ${destino}`],
        ]}
      />
      {embarque.descripcion_mercancia ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.label}>Descripción de la mercancía</Text>
          <Text style={styles.value}>{embarque.descripcion_mercancia}</Text>
        </View>
      ) : null}
    </>
  );
}

export function ProformaHeader({ proforma, cliente, embarque, esConsolidada }: Props) {
  const direccion = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).join(", ")
    : "";
  const credito =
    proforma.dias_credito == null
      ? undefined
      : Number(proforma.dias_credito) === 0
        ? "Contado"
        : `${proforma.dias_credito} días`;
  const meta = [
    { label: "Fecha emisión", value: formatDate(proforma.fecha_emision) },
    { label: "Vigencia", value: vigenciaPlus30(proforma.fecha_emision) },
    { label: "Expediente", value: proforma.expediente },
  ];
  if (proforma.bl_master) meta.push({ label: "BL/MAWB", value: proforma.bl_master });
  if (proforma.operador) meta.push({ label: "Ejecutivo", value: proforma.operador });

  return (
    <>
      <BrandHeader
        tipoDocumento={esConsolidada ? "Proforma Consolidada" : "Proforma"}
        folio={proforma.numero}
        meta={meta}
      />
      <Text style={styles.notice}>Documento sin validez fiscal — uso interno</Text>
      <BillToBlock
        titulo="Facturar a"
        destinatario={{
          nombre: cliente?.nombre || proforma.cliente_nombre,
          rfc: cliente?.rfc || undefined,
          direccion: direccion || undefined,
        }}
      />
      {esConsolidada ? null : <SeccionEmbarque embarque={embarque} />}
      <PaymentTermsBlock
        vigencia={vigenciaPlus30(proforma.fecha_emision)}
        metodoPago="Transferencia electrónica"
        diasCredito={credito}
      />
    </>
  );
}
