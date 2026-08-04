import { Pencil, FileText, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { toTitleCase } from "@/lib/formatters";

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
  const volver = useVolver("/clientes");
  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Clientes"
      icon={<Users className="h-6 w-6 text-accent shrink-0" />}
      title={toTitleCase(cliente.nombre)}
      subtitle={
        cliente.rfc ? (
          <span className="font-mono text-xs tracking-wide">{cliente.rfc}</span>
        ) : undefined
      }

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

export function ClienteNotFoundState() {
  return (
    <DetailNotFound
      icon={Users}
      title="Cliente no encontrado"
      description="El cliente no existe, fue eliminado o no tienes permiso para verlo."
      backTo="/clientes"
      backLabel="Volver a Clientes"
      withContainer={false}
    />
  );
}

