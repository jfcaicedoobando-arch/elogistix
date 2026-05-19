import { Text } from "@react-pdf/renderer";
import { styles } from "../theme/styles";

/** Footer fijo (se repite en cada página vía `fixed`). */
export function Footer() {
  const fecha = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) =>
      `Documento generado el ${fecha} — Libre Carga   ·   Página ${pageNumber} de ${totalPages}`
    } />
  );
}
