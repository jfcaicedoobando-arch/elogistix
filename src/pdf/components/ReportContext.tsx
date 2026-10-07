import type { ReactNode } from "react";
import { View } from "@react-pdf/renderer";
import { styles } from "../theme/styles";

/** Visible scope, filters and methodology; callers own the exact wording. */
export function ReportContext({ children }: { children: ReactNode }) {
  return <View style={styles.contextBox}>{children}</View>;
}
