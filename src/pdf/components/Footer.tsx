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
  // Fecha compacta (DD/MM/AAAA): la columna central del pie es estrecha y el
  // formato largo se partía en dos líneas.
  const fecha = formatFechaEs(new Date().toISOString());

  const marca = (empresaNombre ?? "").trim();
  return (
    <View style={styles.footer} fixed>
      {marca ? (
        <Text
          style={[
            styles.footerColLeft,
            { fontFamily: FONTS.bold, color: COLORS.primary, letterSpacing: 0.5 },
          ]}
        >
          {marca.toUpperCase()}
        </Text>
      ) : (
        <Text style={styles.footerColLeft}>
          Documento generado electrónicamente
        </Text>
      )}
      <Text style={styles.footerColCenter}>Generado el {fecha}</Text>
      <Text
        style={styles.footerColRight}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );

}
