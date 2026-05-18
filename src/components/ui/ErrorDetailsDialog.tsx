import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, X } from "lucide-react";
import { useErrorReport, closeErrorReport } from "@/lib/ui/errorDetailsStore";
import { formatReportMarkdown, formatReportJson } from "@/lib/ui/errorReport";
import { toast as sonnerToast } from "sonner";

/**
 * Diálogo global activado al hacer click en un toast de error con payload
 * de debug. Permite copiar el reporte completo (markdown o JSON) para
 * enviarlo al administrador o pegarlo en Lovable y reproducir el bug.
 */
export function ErrorDetailsDialog() {
  const report = useErrorReport();
  const [copied, setCopied] = useState<"md" | "json" | null>(null);

  const open = report !== null;
  const markdown = report ? formatReportMarkdown(report) : "";
  const json = report ? formatReportJson(report) : "";

  const copy = async (kind: "md" | "json", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      sonnerToast.success(kind === "md" ? "Reporte copiado" : "JSON copiado");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      sonnerToast.error("No se pudo copiar al portapapeles");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeErrorReport(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalles del error</DialogTitle>
        </DialogHeader>

        {report && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Comparte este reporte con tu administrador o pégalo en Lovable para
              reproducir y corregir el problema más rápido.
            </p>
            <pre className="max-h-[50vh] overflow-auto rounded-md border bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-words">
              {markdown}
            </pre>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => copy("json", json)}>
            {copied === "json" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copiar JSON
          </Button>
          <Button onClick={() => copy("md", markdown)}>
            {copied === "md" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copiar reporte
          </Button>
          <Button variant="ghost" onClick={closeErrorReport}>
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
