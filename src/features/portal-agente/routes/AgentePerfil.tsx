/**
 * Perfil del agente: datos de contacto + cambio de contraseña.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { User as UserIcon } from "lucide-react";
import { actualizarPasswordAgente } from "@/features/portal-agente/services/perfil";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useAgenteContext } from "@/features/portal-agente/hooks";
import { SectionHeading } from "@/components/shared/SectionHeading";

export default function AgentePerfil() {
  const { data: ctx } = useAgenteContext();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const cambiarPassword = async () => {
    if (password.length < 8) {
      notifyError(undefined, { title: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    setPending(true);
    try {
      await actualizarPasswordAgente(password);
      notifySuccess(undefined, { title: "Contraseña actualizada" });
      setPassword("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyError(undefined, { title: `Error al cambiar contraseña: ${message}`, error, method: "AGENTE_CHANGE_PASSWORD" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <PageHeader
        icon={<UserIcon className="h-6 w-6 text-accent" />}
        title="Mi Perfil"
        description="Datos de tu cuenta de agente y cambio de contraseña."
      />


      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Agente</p>
            <p className="font-medium">{ctx?.agenteNombre ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{ctx?.email ?? "—"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <SectionHeading>Cambiar contraseña</SectionHeading>
        <div className="space-y-2">
          <Label>Nueva contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <Button onClick={cambiarPassword} disabled={pending || !password}>
          {pending ? "Guardando…" : "Actualizar contraseña"}
        </Button>
      </Card>
    </div>
  );
}
