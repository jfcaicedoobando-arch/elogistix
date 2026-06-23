/**
 * Importar leads desde un CSV (cliente).
 * Shell delgado: la lógica vive en `useImportarLeadsCsv`, el parser en
 * `lib/csv/leadsCsv.ts` y el preview en `ImportarLeadsCsvPreview`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { Upload, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
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

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleImport} disabled={validRows.length === 0 || isPending}>
        {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        Importar {validRows.length} leads
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={FileUp}
      title="Importar leads desde CSV"
      description="Importa múltiples leads de forma masiva desde un archivo CSV."
      size="3xl"
      footer={footer}
    >
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
    </FormDialogShell>
  );
}
