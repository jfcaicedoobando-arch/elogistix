import { useState } from "react";
import { Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

interface Props {
  expediente: string;
  reabriendoEstado: boolean;
  onReabrir: () => void;
}

export function ReabrirEmbarqueButton({ expediente, reabriendoEstado, onReabrir }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={reabriendoEstado}
        onClick={() => setOpen(true)}
      >
        <Unlock className="h-4 w-4 mr-1" /> Reabrir
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Reabrir embarque cerrado"
        description={
          <>
            El embarque <strong>{expediente}</strong> regresará al estado <strong>Entregado</strong> para poder generar la proforma o ajustar facturación. La acción se registrará en la bitácora y en el tracking.
          </>
        }
        confirmLabel="Reabrir"
        isPending={reabriendoEstado}
        onConfirm={() => {
          onReabrir();
          setOpen(false);
        }}
      />
    </>
  );
}
