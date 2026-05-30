import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { dialogSize } from "@/lib/ui/dialogTokens";
import { Loader2 } from "lucide-react";
import { useInviteClientUser } from "@/hooks/cliente";
import { useToast } from "@/hooks/shared";
import { getErrorMessage } from "@/lib/errors";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  organizationId: string;
}

export default function PortalInviteDialog({
  open,
  onOpenChange,
  clienteId,
  organizationId,
}: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const inviteMutation = useInviteClientUser(clienteId);

  const handleInvite = () => {
    inviteMutation.mutate(
      { email, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: (data) => {
          notifySuccess(toast, {
            title: data.is_new ? "Invitación enviada" : "Usuario vinculado",
            description: data.is_new
              ? "Se creó la cuenta y se envió un correo para establecer contraseña."
              : "El usuario existente fue vinculado a este cliente.",
          });
          onOpenChange(false);
          setEmail("");
        },
        onError: (err: unknown) => {
          notifyError(toast, {
            title: "Error",
            description: getErrorMessage(err),
            method: "ON_ERROR",
            errorCode: ERROR_CODES.VALIDATION_FAILED,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogSize.md}>
        <DialogHeader>
          <DialogTitle>Invitar Cliente al Portal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email del cliente</Label>
            <Input
              type="email"
              placeholder="cliente@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Se creará una cuenta con rol de cliente y se le enviará un correo
            para establecer su contraseña. Tendrá acceso solo a sus propios
            embarques, cotizaciones y facturas. Puede agregar varios usuarios al
            mismo cliente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email || inviteMutation.isPending}
          >
            {inviteMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            )}
            Enviar Invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
