/**
 * Vista que se renderiza tras crear credenciales manualmente para un agente.
 * Sólo muestra los datos copiables (email + contraseña) — la contraseña no se
 * vuelve a ver tras cerrar este modal, así que el admin debe copiarla ahora.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useState } from "react";

interface Props {
  email: string;
  password: string;
  onClose: () => void;
}

export function InvitarAgenteCredencialesView({ email, password, onClose }: Props) {
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = async (texto: string, llave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(llave);
      // v13.320.25 · Tanda 3 auditoría toasts: además del cambio de icono,
      // confirmamos con un toast breve para mantener consistencia con el
      // resto de acciones "copiar" en la app (tracking naviera, embarque).
      const etiquetas: Record<string, string> = {
        email: "Email copiado al portapapeles",
        password: "Contraseña copiada al portapapeles",
        ambos: "Credenciales copiadas al portapapeles",
      };
      notifySuccess(undefined, { title: etiquetas[llave] ?? "Copiado al portapapeles", duration: 2000 });
      setTimeout(() => setCopiado((c) => (c === llave ? null : c)), 1500);
    } catch {
      notifyError(undefined, { title: "No se pudo copiar al portapapeles" });
    }
  };

  const ambos = `Email: ${email}\nContraseña: ${password}`;

  return (
    <FormDialogShell
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      icon={Check}
      title="Cuenta creada"
      description="Copia las credenciales y compártelas con el agente por el canal que prefieras (WeChat, WhatsApp, etc.). No volverás a ver la contraseña."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => copiar(ambos, "ambos")}>
            <Copy className="h-4 w-4 mr-1" />
            {copiado === "ambos" ? "Copiado" : "Copiar ambos"}
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <div className="flex gap-2">
            <Input readOnly value={email} className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copiar(email, "email")}
              aria-label="Copiar email"
            >
              {copiado === "email" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Contraseña</Label>
          <div className="flex gap-2">
            <Input readOnly value={password} className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copiar(password, "password")}
              aria-label="Copiar contraseña"
            >
              {copiado === "password" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El agente debe entrar a <code>/login</code> con estas credenciales. Si las pierde, puedes
          reabrir este modal y asignar otra contraseña.
        </p>
      </div>
    </FormDialogShell>
  );
}
