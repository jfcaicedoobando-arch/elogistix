/**
 * OLA 7 · O7.6 — Botón de exportación CSV para listados del CRM.
 */
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onExport: () => void;
  disabled?: boolean;
  label?: string;
}

export default function ExportarCsvButton({ onExport, disabled, label = "Exportar CSV" }: Props) {
  return (
    <Button size="sm" variant="outline" onClick={onExport} disabled={disabled}>
      <Download className="mr-2 h-4 w-4" /> {label}
    </Button>
  );
}
