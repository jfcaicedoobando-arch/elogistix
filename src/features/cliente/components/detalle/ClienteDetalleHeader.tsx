import { ArrowLeft, Pencil, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generarEstadoCuentaPdf } from "@/generators/estadoCuentaPdf";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Cliente {
  id: string;
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
}

interface Props {
  cliente: Cliente;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}

export function ClienteDetalleHeader({ cliente, canEdit, onBack, onEdit }: Props) {
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Volver a clientes">
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="flex-1">
        <h1 className="text-display font-bold tracking-tight">{cliente.nombre}</h1>
        <p className="text-sm text-muted-foreground">{cliente.rfc}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await generarEstadoCuentaPdf({
              id: cliente.id,
              nombre: cliente.nombre,
              rfc: cliente.rfc,
              direccion: cliente.direccion,
              ciudad: cliente.ciudad,
              estado: cliente.estado,
            });
          } catch (err) {
            notifyError(toast, { title: "No se pudo generar el estado de cuenta", description: getErrorMessage(err), error: err, method: "CLIENTE_DETALLE_HEADER" });
          }
        }}
      >
        <FileText className="h-4 w-4 mr-1" /> Estado de cuenta
      </Button>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
      )}
    </div>
  );
}

export function ClienteLoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function ClienteNotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <p className="text-muted-foreground">Cliente no encontrado</p>
      <Button variant="outline" onClick={onBack}>Volver a Clientes</Button>
    </div>
  );
}
