/**
 * Bloque "Facturar a" / cliente. Layout de 1 columna ancha con datos del
 * destinatario formateados consistentemente. Pensado para usarse después
 * del BrandHeader.
 */
import { View, Text } from "@react-pdf/renderer";
import { styles, COLORS, FONTS } from "../theme/styles";

export interface DestinatarioInfo {
  nombre: string;
  rfc?: string;
  direccion?: string;
  contacto?: string;
  telefono?: string;
  email?: string;
}

interface Props {
  titulo?: string;
  destinatario: DestinatarioInfo;
}

export function BillToBlock({ titulo = "Facturar a", destinatario }: Props) {
  const contactoLine = [destinatario.contacto, destinatario.telefono, destinatario.email]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <View style={{ marginBottom: 4 }} wrap={false}>
      <Text style={styles.h3}>{titulo}</Text>
      <View style={{ padding: 9, backgroundColor: COLORS.zebra, borderRadius: 5, borderWidth: 0.6, borderColor: COLORS.border }}>
        <Text style={{ fontSize: 11, fontFamily: FONTS.bold, color: COLORS.ink }}>
          {destinatario.nombre}
        </Text>
        {destinatario.rfc ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
            RFC: {destinatario.rfc}
          </Text>
        ) : null}
        {destinatario.direccion ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
            {destinatario.direccion}
          </Text>
        ) : null}
        {contactoLine ? (
          <Text style={{ fontSize: 9, color: COLORS.muted, marginTop: 2 }}>{contactoLine}</Text>
        ) : null}
      </View>
    </View>
  );
}
