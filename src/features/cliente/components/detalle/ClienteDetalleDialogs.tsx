import DialogContacto from "@/features/cliente/components/DialogContacto";
import DialogEditarCliente from "@/features/cliente/components/DialogEditarCliente";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";

interface Cliente {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
  regimen_fiscal: string;
  uso_cfdi_default: string;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
  /** v13.386.0 — cuenta directa: sus embarques no generan comisión por defecto. */
  sin_comision: boolean;
}

interface Props {
  cliente: Cliente;
  contactDialogOpen: boolean;
  setContactDialogOpen: (v: boolean) => void;
  editingContacto: Parameters<typeof DialogContacto>[0]["contacto"];
  handleSaveContacto: Parameters<typeof DialogContacto>[0]["onSave"];
  isContactSaving: boolean;
  editClienteOpen: boolean;
  setEditClienteOpen: (v: boolean) => void;
  handleSaveCliente: Parameters<typeof DialogEditarCliente>[0]["onSave"];
  isClientSaving: boolean;
  deleteDialogOpen: boolean;
  closeDeleteDialog: (v: boolean) => void;
  confirmDelete: () => void;
  isContactDeleting: boolean;
}

export function ClienteDetalleDialogs(p: Props) {
  return (
    <>
      <DialogContacto
        open={p.contactDialogOpen}
        onOpenChange={p.setContactDialogOpen}
        contacto={p.editingContacto}
        onSave={p.handleSaveContacto}
        isSaving={p.isContactSaving}
      />

      <DialogEditarCliente
        open={p.editClienteOpen}
        onOpenChange={p.setEditClienteOpen}
        cliente={p.cliente}
        onSave={p.handleSaveCliente}
        isSaving={p.isClientSaving}
      />

      <DoubleConfirmDeleteDialog
        open={p.deleteDialogOpen}
        onOpenChange={p.closeDeleteDialog}
        entityName="este contacto"
        description="Estás a punto de eliminar este contacto del cliente. ¿Deseas continuar?"
        finalDescription="Esta acción no se puede deshacer. El contacto será eliminado permanentemente. ¿Confirmas la eliminación?"
        onConfirm={p.confirmDelete}
        isPending={p.isContactDeleting}
      />
    </>
  );
}
