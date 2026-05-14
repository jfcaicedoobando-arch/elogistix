import DialogContacto from "@/components/cliente/DialogContacto";
import DialogEditarCliente from "@/components/cliente/DialogEditarCliente";
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
