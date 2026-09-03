/**
 * v13.823.69 — Conflicto de concurrencia al restaurar un borrador.
 *
 * Analogía: recuperaste tu copia del expediente, pero en el archivo alguien ya
 * firmó una versión más nueva. No pisamos su trabajo: tu captura sigue en
 * pantalla y decides si abres la versión actual o revisas antes de reintentar.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";

interface Props {
  onRecargar: () => void;
  onRevisarDespues: () => void;
}

export function ConflictoSelloAlert({ onRecargar, onRevisarDespues }: Props) {
  return (
    <PageContainer noSpacing className="max-w-6xl pt-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-body-sm flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Otra persona actualizó esta cotización.</strong> Tus cambios locales
            no se han guardado y no se guardarán encima de los suyos. Puedes recargar los
            datos actuales o revisar tu captura y reintentar después.
          </span>
          <span className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRecargar}>
              Recargar datos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRevisarDespues}>
              Revisar después
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    </PageContainer>
  );
}
