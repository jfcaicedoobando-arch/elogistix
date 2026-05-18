import type { EmbarquesPorEstadoBucket, EstadoUiKey } from "@/hooks/operaciones";

type EmbarqueItem = EmbarquesPorEstadoBucket["items"][number];

export interface ExtraInfo {
  label: string;
  tone: "warning" | "danger" | "info" | "muted";
}

export function calcularExtra(estado: EstadoUiKey, e: EmbarqueItem): ExtraInfo | null {
  if (estado === "Llegada" && e.diasEnPuerto > 0) {
    return {
      label: `${e.diasEnPuerto} ${e.diasEnPuerto === 1 ? "día" : "días"} en puerto`,
      tone: e.diasEnPuerto > 7 ? "danger" : "warning",
    };
  }
  if (estado === "En Tránsito" && e.diasParaEta !== null) {
    if (e.diasParaEta < 0) return { label: `ETA vencido (${Math.abs(e.diasParaEta)} d)`, tone: "danger" };
    if (e.diasParaEta === 0) return { label: "Llega hoy", tone: "info" };
    return {
      label: `${e.diasParaEta} ${e.diasParaEta === 1 ? "día" : "días"} para ETA`,
      tone: e.diasParaEta <= 3 ? "warning" : "muted",
    };
  }
  return null;
}

export function toneClass(tone: ExtraInfo["tone"]): string {
  if (tone === "danger") return "text-destructive font-medium";
  if (tone === "warning") return "text-warning font-medium";
  if (tone === "info") return "text-info font-medium";
  return "";
}

export function subtituloPartes(e: EmbarqueItem): string[] {
  const parts: string[] = [];
  if (e.modo) parts.push(e.modo);
  if (e.tipo) parts.push(e.tipo);
  return parts;
}

export function rutaTexto(e: EmbarqueItem): string | null {
  if (!e.origen && !e.destino) return null;
  return `${e.origen || "—"} → ${e.destino || "—"}`;
}
