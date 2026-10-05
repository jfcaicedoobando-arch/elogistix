/** /crm/empresas — Directorio de empresas del CRM (Fase 2). */
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { formatFechaDia } from "@/lib/formatters/dates";
import { ListaObjetosCrm, type Columna } from "@/features/crm/components/objetos/ListaObjetosCrm";
import { NuevoObjetoCrmDialog } from "@/features/crm/components/objetos/NuevoObjetoCrmDialog";
import type { EmpresaRow } from "@/features/crm/services/objetosCrm";
import { estadoEmpresa } from "@/features/crm/services/estadoEmpresaCrm";
import { varianteEstadoEmpresa } from "@/features/crm/components/objetos/FiltroEstadoEmpresaSelect";

const COLUMNAS: Columna<EmpresaRow>[] = [
  { titulo: "Empresa", celda: (f) => <span className="font-medium">{f.nombre}</span> },
  { titulo: "Estado", celda: (f) => { const e = estadoEmpresa(f); return <Badge variant={varianteEstadoEmpresa(e)}>{e}</Badge>; } },
  { titulo: "Alta", celda: (f) => formatFechaDia(f.created_at) },
];

export default function CrmEmpresas() {
  useDocumentTitle("Empresas");
  const { canEditCrm } = usePermissions();
  const [open, setOpen] = useState(false);
  return (
    <PageContainer>
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-primary" />}
        title="Empresas"
        description="Empresas del CRM con sus contactos y oportunidades."
        actions={canEditCrm && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva empresa</Button>}
      />
      <ListaObjetosCrm placeholder="Buscar empresa…" rutaBase="/crm/empresas" columnas={COLUMNAS} objeto="empresa" />
      <NuevoObjetoCrmDialog objeto="empresa" open={open} onOpenChange={setOpen} />
    </PageContainer>
  );
}
