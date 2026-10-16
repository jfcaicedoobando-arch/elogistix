import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePasarAProspecto } from "@/features/crm/hooks/useObjetosCrm";
import { usePermisoPasarAProspecto } from "@/features/crm/hooks/usePermisoPasarAProspecto";
import type { EmpresaProspecto } from "@/features/crm/domain/pasarEmpresaAProspecto";

export function PasarEmpresaAProspectoBoton({ empresa }: { empresa: EmpresaProspecto }) {
  const permiso = usePermisoPasarAProspecto(empresa);
  const pasar = usePasarAProspecto();
  const descripcionId = useId();
  if (permiso.estado === "oculto") return null;
  const motivo = permiso.estado === "comprobar" ? "Verificando permiso…" : permiso.motivo;
  return (
    <div className="flex max-w-sm flex-col items-start gap-1">
      <Button onClick={() => pasar.mutate(empresa.id)}
        disabled={permiso.estado !== "permitido" || pasar.isPending}
        aria-describedby={motivo ? descripcionId : undefined}>
        <ArrowRight className="size-4" /> Pasar a prospecto
      </Button>
      {motivo && <p id={descripcionId} className="text-caption text-muted-foreground" role="status">{motivo}</p>}
      {"reintentar" in permiso && <Button variant="link" size="sm" onClick={permiso.reintentar}>Reintentar verificación</Button>}
    </div>
  );
}
