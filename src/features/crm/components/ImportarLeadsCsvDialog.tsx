/**
 * Importar leads desde un CSV (cliente).
 * Shell delgado: la lógica vive en `useImportarLeadsCsv`, el parser en
 * `lib/csv/leadsCsv.ts` y el preview en `ImportarLeadsCsvPreview`.
 */
import { Upload, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useImportarLeadsCsv } from "@/features/crm/hooks";
import { ImportarLeadsCsvPreview } from "@/features/crm/components/ImportarLeadsCsvPreview";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportarLeadsCsvDialog({ open, onOpenChange }: Props) {
  const {
    rows, fileName, validRows, errorCount, isPending,
    reset, handleFile, handleImport,
  } = useImportarLeadsCsv({ onDone: () => onOpenChange(false) });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar leads desde CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Columnas reconocidas: <code>empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, notas</code>.
            La fila 1 debe contener los encabezados. Empresa es obligatoria.
          </p>

          <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/30">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{fileName || "Selecciona un archivo .csv"}</span>
            <input
              type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
          </label>

          <ImportarLeadsCsvPreview
            rows={rows}
            validCount={validRows.length}
            errorCount={errorCount}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Importar {validRows.length} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
