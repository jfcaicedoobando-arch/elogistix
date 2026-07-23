import { View, Text } from "@react-pdf/renderer";
import { styles, FONTS, COLORS } from "../theme/styles";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  /** Nombre de la empresa emisora a mostrar en la columna izquierda. */
  empresaNombre?: string;
}

/**
 * Footer fijo: 3 columnas (marca / fecha / paginación).
 * Línea superior en color corporativo. Se repite en cada página vía `fixed`.
 */
export function Footer({ empresaNombre }: Props) {
  const fecha = formatFechaEs(new Date().toISOString(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const marca = (empresaNombre ?? "").trim();
  return (
    <View style={styles.footer} fixed>
      {marca ? (
        <Text style={{ fontFamily: FONTS.bold, color: COLORS.primary, letterSpacing: 1 }}>
          {marca.toUpperCase()}
        </Text>
      ) : (
        <Text>Documento generado electrónicamente</Text>
      )}
      <Text>Documento generado el {fecha}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}
