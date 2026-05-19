import { View, Text } from "@react-pdf/renderer";
import { styles } from "../theme/styles";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptosTotales } from "@/generators/cotizacion/conceptosTables";

interface Props {
  totales: ConceptosTotales;
  hayMxn: boolean;
}

export function ResumenBox({ totales: t, hayMxn }: Props) {
  return (
    <View style={styles.totalBox} wrap={false}>
      <Text style={styles.subtotalLine}>Subtotal USD: {formatCurrency(t.subtotalUSD, "USD")}</Text>
      {t.ivaUSD > 0 ? (
        <Text style={styles.subtotalLine}>IVA: {formatCurrency(t.ivaUSD, "USD")}</Text>
      ) : null}
      <Text style={styles.totalLine}>Total USD: {formatCurrency(t.totalUSD, "USD")}</Text>
      {hayMxn ? (
        <>
          <Text style={[styles.subtotalLine, { marginTop: 6 }]}>
            Subtotal MXN: {formatCurrency(t.subtotalMXN, "MXN")}
          </Text>
          <Text style={styles.subtotalLine}>IVA: {formatCurrency(t.ivaMXN, "MXN")}</Text>
          <Text style={styles.totalLine}>Total MXN: {formatCurrency(t.totalMXN, "MXN")}</Text>
        </>
      ) : null}
      <Text style={styles.totalNote}>* Los cargos en destino incluyen IVA</Text>
    </View>
  );
}
