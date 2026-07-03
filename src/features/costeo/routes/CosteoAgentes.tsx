/**
 * Página: Agentes de costeo (forwarders chinos vinculados a Proveedores).
 * Vínculo obligatorio a un proveedor tipo "Agente de Carga".
 * Oleada 4: migrado a PageContainer + ListSkeleton compartidos.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCosteoAgentes, useCosteoAgenteMutations } from "@/features/costeo/hooks/useCosteoAgentes";
import { useProveedoresAgente } from "@/features/costeo/hooks/useNavieraCondiciones";
import type { CosteoAgenteInput } from "@/features/costeo/services/agentes";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDeleteAlert } from "@/features/costeo/components/ConfirmDeleteAlert";
import { CosteoAgentesTable, type AgenteRow } from "@/features/costeo/components/CosteoAgentesTable";
import { CosteoAgenteFormDialog } from "@/features/costeo/components/CosteoAgenteFormDialog";
import { InvitarAgentePortalDialog } from "@/features/costeo/components/InvitarAgentePortalDialog";

const EMPTY: CosteoAgenteInput = {
  nombre: "",
  proveedor_id: "",
  pais: "CN",
  dias_credito: 0,
  contacto_tarifario: "",
  email: "",
  activo: true,
};

export default function CosteoAgentes() {
  const { data: agentes = [], isLoading } = useCosteoAgentes();
  const { crear, actualizar, eliminar } = useCosteoAgenteMutations();
  const { data: proveedores = [] } = useProveedoresAgente();
  const [open, setOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<CosteoAgenteInput>(EMPTY);
  const [aEliminar, setAEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  const [invitarAgente, setInvitarAgente] = useState<AgenteRow | null>(null);

  const valido = form.nombre.trim().length > 0 && form.proveedor_id.length > 0;

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm(EMPTY);
    setIntentoEnvio(false);
    setOpen(true);
  };

  const abrirEditar = (a: AgenteRow) => {
    setEditandoId(a.id);
    setForm({
      nombre: a.nombre,
      proveedor_id: a.proveedor_id ?? "",
      pais: a.pais ?? "CN",
      dias_credito: a.dias_credito ?? 0,
      contacto_tarifario: a.contacto_tarifario ?? "",
      email: a.email ?? "",
      activo: a.activo ?? true,
    });
    setIntentoEnvio(false);
    setOpen(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!valido) return;
    if (editandoId) {
      await actualizar.mutateAsync({ id: editandoId, patch: form });
    } else {
      await crear.mutateAsync(form);
    }
    setForm(EMPTY);
    setEditandoId(null);
    setIntentoEnvio(false);
    setOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Agentes de costeo"
        description="Forwarders chinos vinculados al directorio de Proveedores. Los días de crédito se usan como criterio principal de desempate."
        actions={
          <Button onClick={abrirNuevo}>
            <Plus className="size-4 mr-2" />
            Nuevo agente
          </Button>
        }
      />

      <CosteoAgentesTable
        agentes={agentes}
        isLoading={isLoading}
        onEditar={abrirEditar}
        onEliminar={setAEliminar}
        onInvitarPortal={(a) => setInvitarAgente(a)}
      />

      <CosteoAgenteFormDialog
        open={open}
        onOpenChange={setOpen}
        editando={!!editandoId}
        form={form}
        setForm={setForm}
        proveedores={proveedores}
        intentoEnvio={intentoEnvio}
        isPending={crear.isPending || actualizar.isPending}
        onSubmit={handleGuardar}
      />

      <ConfirmDeleteAlert
        open={!!aEliminar}
        onOpenChange={(o) => !o && setAEliminar(null)}
        title={aEliminar ? `¿Eliminar agente "${aEliminar.nombre}"?` : ""}
        description="Esta acción no se puede deshacer."
        pending={eliminar.isPending}
        onConfirm={() => {
          if (aEliminar) {
            eliminar.mutate(aEliminar.id, { onSuccess: () => setAEliminar(null) });
          }
        }}
      />

      <InvitarAgentePortalDialog
        agente={invitarAgente}
        onOpenChange={(o: boolean) => !o && setInvitarAgente(null)}
      />
    </PageContainer>
  );
}
