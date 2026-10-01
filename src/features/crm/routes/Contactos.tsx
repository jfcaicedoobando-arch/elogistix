/** /crm/contactos — Directorio de contactos del CRM (Fase 2). */
import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Button } from "@/components/ui/button";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { ListaObjetosCrm, type Columna } from "@/features/crm/components/objetos/ListaObjetosCrm";
import { NuevoObjetoCrmDialog } from "@/features/crm/components/objetos/NuevoObjetoCrmDialog";
import type { ContactoRow } from "@/features/crm/services/objetosCrm";

const COLUMNAS: Columna<ContactoRow>[] = [
  { titulo: "Nombre", celda: (f) => <span className="font-medium">{f.nombre}</span> },
  { titulo: "Correo", celda: (f) => f.email ?? "—" },
  { titulo: "Teléfono", celda: (f) => f.telefono ?? "—" },
];

export default function CrmContactos() {
  useDocumentTitle("Contactos");
  const { canEditCrm } = usePermissions();
  const [open, setOpen] = useState(false);
  return (
    <PageContainer>
      <PageHeader
        icon={<UserRound className="h-6 w-6 text-primary" />}
        title="Contactos"
        description="Personas del CRM y las empresas donde trabajan."
        actions={canEditCrm && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo contacto</Button>}
      />
      <ListaObjetosCrm placeholder="Buscar por nombre o correo…" rutaBase="/crm/contactos" columnas={COLUMNAS} objeto="contacto" />
      <NuevoObjetoCrmDialog objeto="contacto" open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}
