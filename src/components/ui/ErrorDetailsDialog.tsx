import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, FileJson } from "lucide-react";
import { useErrorReport, useRecoverableErrorReport, closeErrorReport, openErrorReport } from "@/lib/diagnostics/errorDetailsStore";
import { formatReportMarkdown, formatReportJson, type ErrorReport } from "@/lib/ui/errorReport";
import { extractErrorDetails } from "@/lib/ui/errorDetailsExtract";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { cn } from "@/lib/utils";

function ErrorDetailsContent({ report }: { report: ErrorReport }) {
  const [status, setStatus] = useState("");
  const [copyError, setCopyError] = useState<unknown>(null);
  const diagnostic = copyError ? { ...report, clipboardError: extractErrorDetails(copyError) } : report;
  const json = formatReportJson(diagnostic);
  const markdown = formatReportMarkdown(report);
  const copy = async (kind: "json" | "md") => {
    try {
      await navigator.clipboard.writeText(kind === "json" ? json : markdown);
      setCopyError(null);
      setStatus(kind === "json" ? "JSON copiado" : "Reporte copiado");
    } catch (error) {
      setCopyError(error);
      setStatus("No se pudo copiar. Selecciona el JSON de abajo y cópialo manualmente.");
    }
  };
  return (
    <DialogContent className={cn(dialogSize["3xl"], "z-[70]")} overlayClassName="z-[70]">
      <DialogHeader>
        <DialogTitle>Detalles del error</DialogTitle>
        <DialogDescription>Comparte el JSON con soporte para identificar la operación y el error original.</DialogDescription>
      </DialogHeader>
      <textarea
        aria-label="JSON del error"
        readOnly
        value={json}
        onFocus={(event) => event.currentTarget.select()}
        className="h-[min(40vh,320px)] w-full resize-none overflow-auto rounded-md border bg-muted p-3 text-body-sm font-mono"
      />
      {status && <p role={copyError ? "alert" : "status"} className="text-body-sm text-muted-foreground">{status}</p>}
      <DialogFooter className="gap-2 sm:gap-2">
        <Button onClick={() => void copy("json")}>
          {status === "JSON copiado" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          Copiar JSON
        </Button>
        <Button variant="outline" onClick={() => void copy("md")}><Copy className="h-4 w-4 mr-1" />Copiar reporte</Button>
        <Button variant="ghost" onClick={closeErrorReport}><X className="h-4 w-4 mr-1" />Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Keeps the latest error accessible after toast expiry, without database history. */
export function ErrorDetailsDialog() {
  const report = useErrorReport();
  const recoverable = useRecoverableErrorReport();
  return (
    <>
      {!report && recoverable && (
        <Button size="sm" variant="outline" className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full shadow-sm"
          onClick={() => openErrorReport(recoverable)}><FileJson className="h-4 w-4 mr-2" />Ver último error</Button>
      )}
      <Dialog open={report !== null} onOpenChange={(open) => { if (!open) closeErrorReport(); }}>
        {report && <ErrorDetailsContent key={report.clientReportId ?? report.requestId} report={report} />}
      </Dialog>
    </>
  );
}
