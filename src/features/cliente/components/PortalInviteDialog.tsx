import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
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

  // 13.85.10 — Toasts viven en `useInviteClientUser`.
  const handleInvite = () => {
    inviteMutation.mutate(
      { email, cliente_id: clienteId, organization_id: organizationId },
      {
        onSuccess: () => {
          onOpenChange(false);
          setEmail("");
        },
      },
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Send}
      title="Invitar Cliente al Portal"
      description="Envía una invitación al cliente para acceder al portal de seguimiento."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={!email || inviteMutation.isPending}>
            {inviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Enviar Invitación
          </Button>
        </>
      }
    >
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
    </FormDialogShell>
  );
}
