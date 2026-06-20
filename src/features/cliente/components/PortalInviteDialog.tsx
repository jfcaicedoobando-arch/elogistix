import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { dialogSize, scrollableDialog } from "@/components/shared/utils/dialogTokens";
import { Loader2 } from "lucide-react";
import { useInviteClientUser } from "@/features/cliente/hooks";

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
  const [email, setEmail] = useState("");
  const inviteMutation = useInviteClientUser(clienteId);

  // 13.85.10 — Toasts viven en `useInviteClientUser`. Aquí sólo cerramos el dialog.
  const handleInvite = () => {
    inviteMutation.mutate(
      { email, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setEmail("");
        },
      }
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize.md, scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Invitar Cliente al Portal</DialogTitle>
          <DialogDescription>Envía una invitación al cliente para acceder al portal de seguimiento.</DialogDescription>
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
