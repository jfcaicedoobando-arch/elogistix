/**
 * Alta de Empresa o Contacto del CRM: delega al formulario de cada objeto.
 */
import { NuevaEmpresaDialog } from "./NuevaEmpresaDialog";
import { NuevoContactoDialog } from "./NuevoContactoDialog";

interface Props {
  objeto: "empresa" | "contacto";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NuevoObjetoCrmDialog({ objeto, open, onOpenChange }: Props) {
  return objeto === "empresa"
    ? <NuevaEmpresaDialog open={open} onOpenChange={onOpenChange} />
    : <NuevoContactoDialog open={open} onOpenChange={onOpenChange} />;
}
