import { View, Text } from "@react-pdf/renderer";
import { formatDate } from "@/lib/formatters";
import { styles } from "../theme/styles";
import { KeyValueGrid } from "../components/KeyValueGrid";
import type { ProformaRow, ClienteLite, EmbarqueLite } from "./proformaShared";

interface Props {
  proforma: ProformaRow;
  cliente: ClienteLite;
  embarque: EmbarqueLite;
  esConsolidada: boolean;
}

function HeaderProforma({ proforma, esConsolidada }: { proforma: ProformaRow; esConsolidada: boolean }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.h1Xl}>PROFORMA{esConsolidada ? " CONSOLIDADA" : ""}</Text>
        <Text style={styles.numero}>{proforma.numero}</Text>
      </View>
      <View style={styles.meta}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Text style={[styles.badge, styles.badgeWarning]}>SIN VALIDEZ FISCAL</Text>
          {esConsolidada ? (
            <Text style={[styles.badge, styles.badgeInfo]}>CONSOLIDADA</Text>
          ) : null}
        </View>
        <Text style={styles.metaLine}>Fecha de emisión: {formatDate(proforma.fecha_emision)}</Text>
        <Text style={styles.metaLine}>Expediente: {proforma.expediente}</Text>
        {proforma.bl_master ? <Text style={styles.metaLine}>BL/MAWB: {proforma.bl_master}</Text> : null}
      </View>
    </View>
  );
}

function SeccionCliente({ proforma, cliente }: { proforma: ProformaRow; cliente: ClienteLite }) {
  const direccion = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).join(", ")
    : "";
  return (
    <>
      <Text style={styles.h3}>Datos del Cliente</Text>
      <KeyValueGrid
        columns={2}
        items={[
          ["Razón Social", cliente?.nombre || proforma.cliente_nombre],
          ["RFC", cliente?.rfc || "-"],
        ]}
      />
      <View style={{ marginTop: 2 }}>
        <Text style={styles.label}>Dirección</Text>
        <Text style={styles.value}>{direccion || "-"}</Text>
      </View>
    </>
  );
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

function SeccionCondiciones({ proforma }: { proforma: ProformaRow }) {
  const credito =
    proforma.dias_credito == null
      ? "—"
      : Number(proforma.dias_credito) === 0
        ? "Contado"
        : `${proforma.dias_credito} días`;
  return (
    <>
      <Text style={styles.h3}>Condiciones Comerciales</Text>
      <KeyValueGrid
        columns={2}
        items={[
          ["Ejecutivo de Operaciones", proforma.operador || "—"],
          ["Días de crédito", credito],
        ]}
      />
    </>
  );
}

export function ProformaHeader({ proforma, cliente, embarque, esConsolidada }: Props) {
  return (
    <>
      <HeaderProforma proforma={proforma} esConsolidada={esConsolidada} />
      <SeccionCliente proforma={proforma} cliente={cliente} />
      {esConsolidada ? null : <SeccionEmbarque embarque={embarque} />}
      <SeccionCondiciones proforma={proforma} />
    </>
  );
}
