/** Alta de prospecto externo: empresa + contactos; el KAM se asigna por turno. */
import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { contactoVacio, empresaVacia, validarAlta } from "../domain/altaProspecto";
import { useAltaProspectoBroker } from "../hooks/useBrokerPortal";
import EmpresaBrokerFields from "./EmpresaBrokerFields";
import ContactosBrokerFields from "./ContactosBrokerFields";

interface Props {
  brokerId: string | null;
  open: boolean;
  nombreInicial: string;
  onClose: () => void;
}

export default function AltaProspectoDialog({ brokerId, open, nombreInicial, onClose }: Props) {
  const [empresa, setEmpresa] = useState(() => ({ ...empresaVacia(), nombre: nombreInicial }));
  const [contactos, setContactos] = useState(() => [contactoVacio()]);
  const m = useAltaProspectoBroker(brokerId);
  const problema = validarAlta(empresa, contactos);

  const cerrar = () => { setEmpresa(empresaVacia()); setContactos([contactoVacio()]); onClose(); };
  const guardar = async () => {
    if (problema) return;
    try {
      await m.mutateAsync({ empresa, contactos });
      cerrar();
    } catch {
      // el aviso lo muestra el hook
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => { if (!o) cerrar(); }}
      icon={Building2}
      title="Registrar prospecto externo"
      description="La empresa queda como Prospecto externo con fuente Broker."
      size="lg"
      isDirty
      busy={m.isPending}
      footer={
        <>
          {problema && <span className="mr-auto text-body-sm text-muted-foreground">{problema}</span>}
          <Button type="button" variant="outline" onClick={cerrar} disabled={m.isPending}>Cancelar</Button>
          <Button onClick={guardar} disabled={!!problema} loading={m.isPending}>Registrar</Button>
        </>
      }
    >
      <FormDialogSection title="Empresa">
        <EmpresaBrokerFields value={empresa} onChange={setEmpresa} />
      </FormDialogSection>
      <FormDialogSection title="Contactos">
        <ContactosBrokerFields value={contactos} onChange={setContactos} />
      </FormDialogSection>
    </FormDialogShell>
  );
}
