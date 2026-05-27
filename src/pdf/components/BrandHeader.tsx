/**
 * Header unificado para todos los PDFs del sistema.
 * Izquierda: marca tipográfica + datos del emisor (cargados desde configuracion).
 * Derecha: tipo de documento + folio + metadatos.
 * Banda superior de 4pt en color corporativo.
 */
import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS } from "../theme/styles";

export interface EmisorInfo {
  razonSocial?: string;
  subtitulo?: string;
  rfc?: string;
  direccion?: string;
  contacto?: string;
}

interface Meta {
  label: string;
  value: string;
}

interface Props {
  /** "Cotización", "Proforma", "Proforma Consolidada", etc. */
  tipoDocumento: string;
  /** Folio/numero del documento. */
  folio: string;
  /** Metadatos a mostrar en columna derecha (fecha, expediente, etc.). */
  meta?: Meta[];
  /** Datos del emisor. Si se omite usa placeholder neutro ("Empresa"). */
  emisor?: EmisorInfo;
}

const EMISOR_FALLBACK: Required<EmisorInfo> = {
  razonSocial: "Empresa",
  subtitulo: "",
  rfc: "",
  direccion: "",
  contacto: "",
};

export function BrandHeader({ tipoDocumento, folio, meta = [], emisor }: Props) {
  const e = { ...EMISOR_FALLBACK, ...(emisor ?? {}) };
  return (
    <>
      <View style={styles.topBand} fixed />
      <View style={styles.header}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandMark}>{e.razonSocial.toUpperCase()}</Text>
          {e.subtitulo ? <Text style={styles.brandSub}>{e.subtitulo}</Text> : null}
          {e.rfc ? <Text style={[styles.brandLine, { marginTop: 6 }]}>RFC: {e.rfc}</Text> : null}
          {e.direccion ? <Text style={styles.brandLine}>{e.direccion}</Text> : null}
          {e.contacto ? <Text style={styles.brandLine}>{e.contacto}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: "55%" }}>
          <Text style={styles.docType}>{tipoDocumento}</Text>
          <Text style={styles.docNumber}>{folio}</Text>
          <View style={{ marginTop: 6, alignItems: "flex-end" }}>
            {meta.map((m) => (
              <Text key={m.label} style={[styles.metaLine, { fontSize: 9 }]}>
                <Text style={{ color: COLORS.mutedLight }}>{m.label}: </Text>
                <Text style={{ color: COLORS.ink }}>{m.value}</Text>
              </Text>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}
