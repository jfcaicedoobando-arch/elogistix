/** Tipo de fila de la tabla Cartera (compartido entre archivos de columnas). */
import type { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";

export type CarteraRow = NonNullable<ReturnType<typeof useCarteraPendiente>["data"]>[number];
