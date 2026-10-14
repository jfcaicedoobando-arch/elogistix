/** Botón "Eliminar" de la ficha de empresa con doble confirmación (escribir ELIMINAR). */
import { useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useEliminarEmpresaCrm } from "@/features/crm/hooks/useObjetosCrm";

export function EliminarEmpresaBoton({ empresaId, nombre }: { empresaId: string; nombre: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const eliminar = useEliminarEmpresaCrm();
  const confirmar = async () => {
    await eliminar.mutateAsync(empresaId);
    setOpen(false);
    void navigate("/crm/empresas");
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Eliminar
      </Button>
      <DoubleConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        entityName={nombre}
        description="La empresa dejará de aparecer en el CRM. Sus oportunidades y actividades se conservan."
        onConfirm={() => confirmar().catch(() => undefined)}
        isPending={eliminar.isPending}
      />
    </>
  );
}
