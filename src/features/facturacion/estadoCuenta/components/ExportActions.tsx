import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileDown, Sheet } from "lucide-react";

// TODO(v13.299): implementar generación real de PDF (jsPDF-autotable) y XLSX
// (xlsxwriter/exceljs). Los datos ya vienen normalizados desde
// `useEstadoCuenta` — sólo hace falta un adapter puro a filas planas.
export function ExportActions() {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <FileDown className="h-4 w-4 mr-1.5" />
                PDF
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Próximamente</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <Sheet className="h-4 w-4 mr-1.5" />
                Excel
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Próximamente</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
