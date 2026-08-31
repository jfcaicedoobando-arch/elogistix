/**
 * M-12 (v14-2): aviso de que el mismo wizard está abierto en otra pestaña y
 * acaba de guardar, para que el autoguardado no se pise en silencio.
 *
 * Extraído de `NuevaCotizacion.tsx` (límite Power-of-10 de 200 líneas).
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";

interface Props {
  onDescartar: () => void;
}

export function ConflictoPestanaAlert({ onDescartar }: Props) {
  return (
    <PageContainer noSpacing className="max-w-6xl pt-4">
      <Alert className="border-warning/40 bg-warning/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-body-sm flex items-center justify-between gap-2">
          <span>
            <strong>Tienes este wizard abierto en otra pestaña</strong> y acaba de guardar
            cambios ahí. Para no mezclar capturas, trabaja en una sola pestaña.
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onDescartar}>
            Entendido
          </Button>
        </AlertDescription>
      </Alert>
    </PageContainer>
  );
}
