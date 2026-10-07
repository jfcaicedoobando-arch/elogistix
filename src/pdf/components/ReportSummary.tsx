import { Text, View } from "@react-pdf/renderer";
import { COLORS, styles } from "../theme/styles";

interface Metric { label: string; value: string; tone?: "default" | "warning" | "success" }
export function ReportSummary({ items, columns = 4 }: { items: Metric[]; columns?: 2 | 3 | 4 }) {
  return <View style={styles.kpiRow}>
    {items.map((item, index) => <View key={`${item.label}-${index}`} style={[styles.kpiCard, { width: `${100 / columns}%` }]} wrap={false}>
      <View style={styles.kpiInner}>
        <Text style={styles.kpiLabel}>{item.label}</Text>
        <Text style={[styles.kpiValue, item.tone === "warning" ? { color: COLORS.warningFg } : item.tone === "success" ? { color: COLORS.successFg } : {}]}>{item.value}</Text>
      </View>
    </View>)}
  </View>;
}
