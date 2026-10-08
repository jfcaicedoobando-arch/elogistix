import { Text, View } from "@react-pdf/renderer";
import { styles } from "../theme/styles";

export interface EstadoCuentaAlcance {
  parcial: boolean;
  filtros: readonly string[];
}

export function EstadoCuentaAlcanceResumen({ alcance, facturas }: {
  alcance: EstadoCuentaAlcance;
  facturas: number;
}) {
  return (
    <View style={[styles.contextBox, styles.contextText]} wrap={false}>
      <Text>
        {alcance.parcial ? "Alcance parcial: subtotales del corte seleccionado." : "Alcance: cartera del cliente."}
        {` Facturas incluidas: ${facturas}.`}
      </Text>
      <Text>Filtros: {alcance.filtros.length ? alcance.filtros.join(" · ") : "Sin filtros adicionales"}.</Text>
      {alcance.parcial && <Text>Los subtotales corresponden a estas facturas y no representan el saldo global del cliente.</Text>}
    </View>
  );
}
