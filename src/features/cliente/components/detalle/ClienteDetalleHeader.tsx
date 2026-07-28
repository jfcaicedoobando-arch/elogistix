import { Pencil, FileText, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailHeader } from "@/components/shared/DetailHeader";

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

export function ClienteDetalleHeader({ cliente, canEdit, onEdit }: Props) {
  const navigate = useNavigate();
  return (
    <DetailHeader
      backTo="/clientes"
      backLabel="Clientes"
      icon={<Users className="h-6 w-6 text-accent shrink-0" />}
      title={cliente.nombre}
      subtitle={cliente.rfc}
      trailing={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/clientes/${cliente.id}/estado-de-cuenta`)}
          >
            <FileText className="h-4 w-4 mr-1" /> Estado de cuenta
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </>
      }
    />
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
