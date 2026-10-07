import { View, Text } from "@react-pdf/renderer";
import { styles, FONTS, COLORS } from "../theme/styles";
import { formatFechaEs } from "@/lib/formatters";
import type { EmisorInfo } from "./BrandHeader";

interface Props {
  /** Nombre de la empresa emisora a mostrar en la columna izquierda. */
  empresaNombre?: string;
  emisor?: EmisorInfo;
}

/**
 * Footer fijo: 3 columnas (marca / fecha / paginación).
 * Línea superior en color corporativo. Se repite en cada página vía `fixed`.
 */
export function Footer({ empresaNombre, emisor }: Props) {
  // Fecha compacta (DD/MM/AAAA): la columna central del pie es estrecha y el
  // formato largo se partía en dos líneas.
  const fecha = formatFechaEs(new Date().toISOString(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const nombre = (emisor?.organizacionNombre || empresaNombre || emisor?.razonSocial || "").trim();
  const marca = nombre === "Empresa" ? "" : nombre;
  return (
    <View style={styles.footer} fixed>
      {marca ? (
        <Text
          style={[
            styles.footerColLeft,
            { fontFamily: FONTS.bold, color: COLORS.primary, maxLines: 2 },
          ]}
        >
          {marca}
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
