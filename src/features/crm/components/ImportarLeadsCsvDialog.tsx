/**
 * Importar leads desde un CSV (cliente).
 * Shell delgado: la lógica vive en `useImportarLeadsCsv`, el parser en
 * `lib/csv/leadsCsv.ts` y el preview en `ImportarLeadsCsvPreview`.
 * Migrado a `FormDialogShell` (v13.121.0).
 */
import { Upload, FileUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    duplicados, duplicadosCargando, duplicadosError,
    puedeImportar, reintentarDuplicados,
    reset, handleFile, handleImport,
  } = useImportarLeadsCsv({ onDone: () => onOpenChange(false) });


  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      <Button onClick={handleImport} disabled={!puedeImportar} loading={isPending}>
        {duplicadosCargando ? "Revisando duplicados…" : `Importar ${validRows.length} leads`}
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
      stepper={{ step: rows.length === 0 ? 1 : 2, totalSteps: 2, labels: ["Cargar archivo", "Revisar e importar"] }}
      footer={footer}
    >
      <p className="text-body-sm text-muted-foreground">
        Columnas reconocidas: <code>empresa, contacto, email, telefono, ciudad, pais, fuente, estado, score, notas</code>.
        La fila 1 debe contener los encabezados. Empresa es obligatoria. El campo{" "}
        <code>estado</code> sólo acepta <code>Nuevo</code>, <code>Contactado</code> o{" "}
        <code>Descalificado</code> (si va vacío se usa <code>Nuevo</code>); los estados
        Calificado, Prospecto, Pendiente de alta y Convertido los administra el ERP.
      </p>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer hover:bg-muted/30">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-body">{fileName || "Selecciona un archivo .csv"}</span>
        <input
          type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Reset del input: permite volver a elegir el MISMO archivo.
            e.target.value = "";
            if (f) void handleFile(f);
          }}
        />
      </label>

      {duplicadosError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No se pudo revisar duplicados</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              Para no crear leads repetidos, la importación queda bloqueada hasta que la
              revisión termine correctamente.
            </span>
            <Button size="sm" variant="outline" onClick={reintentarDuplicados}>
              Reintentar revisión
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ImportarLeadsCsvPreview
        rows={rows}
        validCount={validRows.length}
        errorCount={errorCount}
        duplicados={duplicados}
        duplicadosCargando={duplicadosCargando}
      />
    </FormDialogShell>
  );
}
