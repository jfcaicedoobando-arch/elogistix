import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/DocumentChecklist";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  validateArchivo,
  MAX_FILE_SIZE_MB,
  type StepValidationErrors,
} from "@/lib/domain/embarqueWizardSchemas";
import { useToast } from "@/hooks/use-toast";

interface Props {
  documentos: DocumentoChecklist[];
  onFileChange: (docNombre: string, file: File | undefined) => void;
  errors?: StepValidationErrors;
}

export function StepDocumentos({ documentos, onFileChange, errors = {} }: Props) {
  const { toast } = useToast();
  const adjuntados = useMemo(() => documentos.filter((d) => d.adjuntado).length, [documentos]);
  const total = documentos.length;
  const erroresList = Object.entries(errors);

  const handleFileChange = (nombre: string, file: File | undefined) => {
    if (file) {
      const err = validateArchivo({ nombre, size: file.size, type: file.type });
      if (err) {
        toast({ title: "Documento rechazado", description: err, variant: "destructive" });
        return;
      }
    }
    onFileChange(nombre, file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Documentos Requeridos</span>
          <span className="text-sm font-normal text-muted-foreground">
            {adjuntados} de {total} adjuntos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {erroresList.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {erroresList.map(([k, v]) => (
                <div key={k}><strong>{k}:</strong> {v}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        <DocumentChecklist
          documentos={documentos}
          onFileChange={handleFileChange}
          descripcion={`Adjunta los documentos requeridos para este embarque (opcional, podrás agregar más después). Tamaño máximo: ${MAX_FILE_SIZE_MB}MB. Formatos: PDF, JPG, PNG, XLSX, DOCX.`}
        />
      </CardContent>
    </Card>
  );
}
