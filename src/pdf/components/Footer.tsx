import { View, Text } from "@react-pdf/renderer";
import { styles, FONTS, COLORS } from "../theme/styles";

/**
 * Footer fijo con marca: 3 columnas (brand / fecha / paginación).
 * Línea superior en color corporativo. Se repite en cada página vía `fixed`.
 */
export function Footer() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <View style={styles.footer} fixed>
      <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary, letterSpacing: 1 }}>
        LIBRE CARGA
      </Text>
      <Text>Documento generado el {fecha}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}
