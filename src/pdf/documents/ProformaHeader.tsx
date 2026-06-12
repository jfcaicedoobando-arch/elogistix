import { View, Text } from "@react-pdf/renderer";
import { formatDate } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { KeyValueGrid } from "../components/KeyValueGrid";
import { BrandHeader, type EmisorInfo } from "../components/BrandHeader";
import { BillToBlock } from "../components/BillToBlock";
import { PaymentTermsBlock } from "../components/PaymentTermsBlock";
import type { ProformaRow, ClienteLite, EmbarqueLite } from "./proformaShared";

interface Props {
  proforma: ProformaRow;
  cliente: ClienteLite;
  embarque: EmbarqueLite;
  esConsolidada: boolean;
  emisor?: EmisorInfo;
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

function resumirContenedores(contenedores: NonNullable<EmbarqueLite["contenedores"]>): string {
  if (contenedores.length === 0) return "";
  if (contenedores.length <= 3) {
    return contenedores
      .map((c) => `${c.numero_contenedor}${c.tipo_contenedor ? ` · ${c.tipo_contenedor}` : ""}`)
      .join(", ");
  }
  const tipos = new Map<string, number>();
  for (const c of contenedores) {
    const t = c.tipo_contenedor || "—";
    tipos.set(t, (tipos.get(t) ?? 0) + 1);
  }
  const resumen = Array.from(tipos.entries())
    .map(([t, n]) => `${n} × ${t}`)
    .join(" + ");
  const numeros = contenedores.map((c) => c.numero_contenedor).join(", ");
  return `${resumen} — ${numeros}`;
}

function SeccionEmbarque({ embarque }: { embarque: EmbarqueLite }) {
  const origen = embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || "-";
  const destino = embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || "-";
  const contenedores = embarque.contenedores ?? [];
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
      {contenedores.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.label}>Contenedores</Text>
          <Text style={styles.value}>{resumirContenedores(contenedores)}</Text>
        </View>
      ) : null}
      {embarque.descripcion_mercancia ? (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.label}>Descripción de la mercancía</Text>
          <Text style={styles.value}>{embarque.descripcion_mercancia}</Text>
        </View>
      ) : null}
    </>
  );
}

export function ProformaHeader({ proforma, cliente, embarque, esConsolidada, emisor }: Props) {
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
  if (proforma.bl_master) meta.push({ label: "BL Master / MAWB", value: proforma.bl_master });
  if (embarque.bl_house) meta.push({ label: "BL House / HAWB", value: embarque.bl_house });
  if (proforma.operador) meta.push({ label: "Ejecutivo", value: proforma.operador });

  return (
    <>
      <BrandHeader
        tipoDocumento={esConsolidada ? "Proforma Consolidada" : "Proforma"}
        folio={proforma.numero}
        meta={meta}
        emisor={emisor}
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
