/**
 * Diálogo para invitar a un agente de carga al Portal del Agente.
 * Llama a la edge function `user-management` con action `invite-agente`.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { supabase } from "@/integrations/supabase/client";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import type { AgenteRow } from "./CosteoAgentesTable";

interface Props {
  agente: AgenteRow | null;
  onOpenChange: (open: boolean) => void;
}

export function InvitarAgentePortalDialog({ agente, onOpenChange }: Props) {
  const { organizationId } = useOrganization();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  const handleInvite = async () => {
    if (!agente || !organizationId) return;
    if (!email.includes("@")) {
      notifyError(undefined, { title: "Email inválido" });
      return;
    }
    setPending(true);
    const { data, error } = await supabase.functions.invoke("user-management", {
      body: {
        action: "invite-agente",
        email,
        agente_id: agente.id,
        organization_id: organizationId,
      },
    });
    setPending(false);
    if (error) {
      notifyError(undefined, { title: `Error al invitar: ${error.message}`, error, method: "INVITE_AGENTE" });
      return;
    }
    const isNew = (data as { is_new?: boolean } | null)?.is_new;
    notifySuccess(undefined, {
      title: isNew ? "Invitación enviada al agente" : "Usuario existente vinculado",
    });
    setEmail("");
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={!!agente}
      onOpenChange={onOpenChange}
      icon={Send}
      title="Invitar agente al Portal"
      description={
        agente
          ? `Envía una invitación a ${agente.nombre} para acceder al Portal del Agente y subir sus tarifas.`
          : ""
      }
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={!email || pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Enviar invitación
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label>Email del agente</Label>
        <Input
          type="email"
          placeholder="contacto@agente.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Se creará una cuenta con rol <strong>Agente de Carga</strong> y se le enviará un correo
        para establecer su contraseña. Tendrá acceso al portal <code>/agente</code> donde podrá
        subir tarifas marítimas y carta garantía. Sus tarifas nuevas quedarán en estado
        <em> borrador</em> hasta que operaciones las apruebe.
      </p>
    </FormDialogShell>
  );
}
