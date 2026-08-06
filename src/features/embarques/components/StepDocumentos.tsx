import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DocumentChecklist, { type DocumentoChecklist } from "@/components/shared/DocumentChecklist";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import {
  validateArchivo,
  MAX_FILE_SIZE_MB,
  type StepValidationErrors,
} from "@/features/embarques/domain/embarqueWizardSchemas";
import { notifyError } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
interface Props {
  documentos: DocumentoChecklist[];
  onFileChange: (docNombre: string, file: File | undefined) => void;
  errors?: StepValidationErrors;
}

export function StepDocumentos({ documentos, onFileChange, errors = {} }: Props) {
  const adjuntados = useMemo(() => documentos.filter((d) => d.adjuntado).length, [documentos]);
  const total = documentos.length;
  const pendientes = total - adjuntados;
  const hasErrors = Object.keys(errors).length > 0;

  const handleFileChange = (nombre: string, file: File | undefined) => {
    if (file) {
      const err = validateArchivo({ nombre, size: file.size, type: file.type });
      if (err) {
        notifyError(undefined, { title: "Documento rechazado", message: err, method: "HANDLE_FILE_CHANGE", errorCode: ERROR_CODES.VALIDATION_FAILED });
        return;
      }
    }
    onFileChange(nombre, file);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Documentos Requeridos</span>
          <span className="text-xs font-normal text-muted-foreground">
            {adjuntados} de {total} adjuntos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasErrors && <ValidationAlert severity="error" errors={errors} />}
        {!hasErrors && pendientes > 0 && (
          <ValidationAlert
            severity="warning"
            title="Documentos pendientes"
            message={`Faltan ${pendientes} de ${total} documentos. Puedes adjuntarlos ahora o más tarde desde el detalle del embarque.`}
          />
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
