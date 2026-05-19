import { View, Text } from "@react-pdf/renderer";
import { styles } from "../theme/styles";

interface Props {
  items: Array<[label: string, value: string]>;
  columns?: 2 | 3 | 4;
}

/**
 * Reemplazo de la <div class="grid"> HTML por Flexbox nativo de @react-pdf/renderer.
 * Las celdas hacen wrap automático y los textos largos rompen sin romper layout.
 */
export function KeyValueGrid({ items, columns = 4 }: Props) {
  const cellStyle =
    columns === 2 ? styles.gridCell2 : columns === 3 ? styles.gridCell3 : styles.gridCell4;
  return (
    <View style={styles.gridRow}>
      {items.map(([label, value], i) => (
        <View key={`${label}-${i}`} style={cellStyle} wrap={false}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
